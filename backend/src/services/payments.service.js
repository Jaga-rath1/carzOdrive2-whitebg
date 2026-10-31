const mongoose = require('mongoose');
const crypto = require('crypto');
const https = require('https');
const { Payment } = require('../models/payment.model');
const { Booking } = require('../models/booking.model');
const { env } = require('../config/env');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

const CASHFREE_BASE =
  env.cashfree.environment === 'production' ? 'api.cashfree.com' : 'sandbox.cashfree.com';

function cashfreeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: CASHFREE_BASE,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': env.cashfree.appId,
        'x-client-secret': env.cashfree.secretKey,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function createOnlinePaymentOrder(bookingId, customerId) {
  const booking = await Booking.findOne({ _id: bookingId, customerId, paymentStatus: 'PENDING' }).populate(
    'customerId',
    'name email phone'
  );
  if (!booking) {
    const err = new Error('Booking not found or not eligible for payment');
    err.statusCode = 404;
    throw err;
  }

  const orderId = `CZ-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const customer = booking.customerId;

  const cfBody = {
    order_id: orderId,
    order_amount: booking.priceBreakdown.totalAmount,
    order_currency: 'INR',
    customer_details: {
      customer_id: customerId.toString(),
      customer_email: customer?.email || 'customer@carzodrive.com',
      customer_phone: customer?.phone || '9999999999',
      customer_name: customer?.name || 'Customer',
    },
    order_meta: {
      notify_url: `${env.backendUrl}/api/v1/payments/webhook/cashfree`,
    },
  };

  const cfRes = await cashfreeRequest('POST', '/pg/orders', cfBody);
  if (cfRes.status !== 200) {
    const err = new Error(cfRes.body?.message || 'Failed to create payment order');
    err.statusCode = 502;
    throw err;
  }

  const payment = await Payment.create({
    bookingId,
    customerId,
    amount: booking.priceBreakdown.totalAmount,
    method: 'ONLINE',
    cashfreeOrderId: orderId,
    cashfreeSessionId: cfRes.body.payment_session_id,
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });

  booking.paymentId = payment._id;
  booking.paymentStatus = 'PROCESSING';
  await booking.save();

  return {
    paymentId: payment._id,
    orderId,
    paymentSessionId: cfRes.body.payment_session_id,
    amount: booking.priceBreakdown.totalAmount,
  };
}

function verifyWebhookSignature(rawBody, signature) {
  if (!rawBody || !signature) return false;
  try {
    const payload = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    const computed = crypto.createHmac('sha256', env.cashfree.webhookSecret).update(payload).digest('base64');
    return computed === signature;
  } catch {
    return false;
  }
}

async function handleWebhook(rawBody, signature) {
  if (env.cashfree.webhookSecret && env.cashfree.webhookSecret !== 'test_webhook_secret') {
    if (!verifyWebhookSignature(rawBody, signature)) {
      const err = new Error('Invalid webhook signature');
      err.statusCode = 401;
      throw err;
    }
  }

  let event;
  try {
    event = typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody || {});
  } catch {
    event = rawBody || {};
  }
  const orderId = event?.data?.order?.order_id || event?.order_id;
  const eventType = event.type;

  if (!orderId) return { processed: false, reason: 'No order ID' };

  const payment = await Payment.findOne({ cashfreeOrderId: orderId });
  if (!payment) return { processed: false, reason: 'Payment not found' };

  const alreadyProcessed = payment.webhookEvents.some(
    (e) => e.eventType === eventType && e.payload?.cf_payment_id === event?.data?.payment?.cf_payment_id
  );
  if (alreadyProcessed) return { processed: true, reason: 'Duplicate event' };

  payment.webhookEvents.push({ eventType, payload: event.data, receivedAt: new Date() });

  const booking = await Booking.findById(payment.bookingId);

  if (eventType === 'PAYMENT_SUCCESS_WEBHOOK' || eventType === 'PAYMENT_SUCCESS') {
    payment.status = 'PAID';
    payment.cashfreePaymentId = event?.data?.payment?.cf_payment_id;
    if (booking) {
      booking.paymentStatus = 'PAID';
      if (booking.status === 'PENDING') booking.status = 'CONFIRMED';
      await booking.save();

      try {
        const bookingsSvc = require('./bookings.service');
        const populated = await Booking.findById(booking._id)
          .populate('customerId', 'name email phone')
          .populate('vehicleId')
          .populate('bikeId')
          .populate('driverId')
          .populate('packageId')
          .populate('paymentId');
        bookingsSvc.dispatchBookingNotificationsSafely(populated || booking, payment.guestEmail || payment.customerEmail);
      } catch (notifyErr) {
        console.error('Webhook notification dispatch notice:', notifyErr?.message);
      }
    }
  } else if (eventType === 'PAYMENT_FAILED_WEBHOOK' || eventType === 'PAYMENT_FAILED') {
    payment.status = 'FAILED';
    if (booking) {
      booking.paymentStatus = 'FAILED';
      await booking.save();
    }
  }

  await payment.save();
  return { processed: true };
}

async function verifyPayment(cashfreeOrderId, customerId) {
  const payment = await Payment.findOne({ cashfreeOrderId, customerId });
  if (!payment) {
    const err = new Error('Payment record not found');
    err.statusCode = 404;
    throw err;
  }

  const cfRes = await cashfreeRequest('GET', `/pg/orders/${cashfreeOrderId}`, null);
  if (cfRes.status !== 200) {
    const err = new Error('Failed to verify payment with Cashfree');
    err.statusCode = 502;
    throw err;
  }

  const orderStatus = cfRes.body.order_status;
  if (orderStatus === 'PAID' && payment.status !== 'PAID') {
    payment.status = 'PAID';
    await payment.save();
    const booking = await Booking.findById(payment.bookingId);
    if (booking && booking.paymentStatus !== 'PAID') {
      booking.paymentStatus = 'PAID';
      if (booking.status === 'PENDING') booking.status = 'CONFIRMED';
      await booking.save();

      try {
        const bookingsSvc = require('./bookings.service');
        const populated = await Booking.findById(booking._id)
          .populate('customerId', 'name email phone')
          .populate('vehicleId')
          .populate('bikeId')
          .populate('driverId')
          .populate('packageId')
          .populate('paymentId');
        bookingsSvc.dispatchBookingNotificationsSafely(populated || booking, payment.guestEmail || payment.customerEmail);
      } catch (notifyErr) {
        console.error('Verify payment notification dispatch notice:', notifyErr?.message);
      }
    }
  }

  return payment;
}

async function processCheckout(data, customerId = null) {
  let booking = null;

  if (data.bookingId) {
    booking = await Booking.findById(data.bookingId);
  } else if (data.bookingNumber) {
    booking = await Booking.findOne({ bookingNumber: data.bookingNumber });
  }

  const isExistingBooking = Boolean(booking);

  // If no existing booking, create one using universal booking logic
  if (!booking) {
    const bookingsSvc = require('./bookings.service');
    booking = await bookingsSvc.createUniversalBooking(customerId, data);
  } else {
    // Update existing booking with incoming payment and guest data
    if (data.paymentMode) booking.paymentMode = data.paymentMode;
    if (data.onlineMethod) booking.onlineMethod = data.onlineMethod;
    if (data.upiApp) booking.upiApp = data.upiApp;
    if (data.guestName) booking.guestName = data.guestName;
    if (data.guestPhone) booking.guestPhone = data.guestPhone;
    if (data.guestEmail) booking.guestEmail = data.guestEmail;

    const total = Number(data.totalAmount || booking.totalAmount || booking.priceBreakdown?.totalAmount || 0);
    let paid = Number(data.paidAmount !== undefined ? data.paidAmount : booking.paidAmount || 0);
    let balance = Number(data.balanceAmount !== undefined ? data.balanceAmount : booking.balanceAmount || 0);

    if (booking.paymentMode === 'full') {
      paid = total;
      balance = 0;
      booking.paymentStatus = 'PAID';
      booking.status = 'CONFIRMED';
    } else if (booking.paymentMode === 'offline') {
      paid = 0;
      balance = total;
      booking.paymentStatus = 'OFFLINE_PENDING';
    } else if (booking.paymentMode === 'partial') {
      if (!paid) paid = Math.max(499, Math.round(total * 0.25));
      balance = Math.max(0, total - paid);
      booking.paymentStatus = 'PARTIALLY_PAID';
      booking.status = 'CONFIRMED';
    }

    booking.totalAmount = total;
    booking.paidAmount = paid;
    booking.balanceAmount = balance;
    if (data.transactionId) booking.transactionId = data.transactionId;
    await booking.save();
  }

  // Find or create matching Payment record
  let payment = null;
  if (booking.paymentId) {
    payment = await Payment.findById(booking.paymentId);
  }
  if (!payment) {
    payment = await Payment.findOne({ bookingId: booking._id });
  }

  const txnId =
    data.transactionId ||
    booking.transactionId ||
    `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const paymentPayload = {
    bookingId: booking._id,
    bookingNumber: booking.bookingNumber,
    customerId: customerId || booking.customerId || null,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    guestPhone: booking.guestPhone,
    amount: booking.totalAmount,
    paidAmount: booking.paidAmount,
    balanceAmount: booking.balanceAmount,
    currency: 'INR',
    paymentMode: booking.paymentMode,
    method: booking.paymentMode === 'offline' ? 'OFFLINE' : 'ONLINE',
    onlineMethod: booking.onlineMethod,
    upiApp: booking.upiApp,
    transactionId: txnId,
    status: booking.paymentStatus,
    offlineMethod: booking.paymentMode === 'offline' ? 'WHATSAPP' : undefined,
    gatewayResponse: data.gatewayResponse || undefined,
  };

  if (!payment) {
    payment = await Payment.create(paymentPayload);
  } else {
    Object.assign(payment, paymentPayload);
    await payment.save();
  }

  // Link payment back to booking
  booking.paymentId = payment._id;
  booking.transactionId = payment.transactionId;
  await booking.save();

  // If this was an existing booking completing payment, dispatch updated invoice & admin notification
  if (isExistingBooking) {
    try {
      const bookingsSvc = require('./bookings.service');
      const populated = await Booking.findById(booking._id)
        .populate('customerId', 'name email phone')
        .populate('vehicleId')
        .populate('bikeId')
        .populate('driverId')
        .populate('packageId')
        .populate('paymentId');
      bookingsSvc.dispatchBookingNotificationsSafely(populated || booking, data.guestEmail || data.customerEmail);
    } catch (e) {
      console.error('Failed to trigger email dispatch in processCheckout:', e?.message);
    }
  }

  return {
    booking,
    payment,
    bookingNumber: booking.bookingNumber,
    paymentNumber: payment.paymentNumber,
    invoiceNumber: booking.invoiceNumber,
    invoiceDate: booking.invoiceDate,
    transactionId: payment.transactionId,
    amount: booking.totalAmount,
    paidAmount: booking.paidAmount,
    balanceAmount: booking.balanceAmount,
    status: payment.status,
  };
}

async function updatePaymentStatus(paymentId, status, adminId, notes, approve) {
  const payment = await Payment.findById(paymentId);
  if (!payment) {
    const err = new Error('Payment not found');
    err.statusCode = 404;
    throw err;
  }

  const finalStatus = status || (approve ? 'PAID' : 'FAILED');
  payment.status = finalStatus;
  payment.verifiedBy = adminId;
  payment.verifiedAt = new Date();
  if (notes) payment.verificationNotes = notes;

  const booking = await Booking.findById(payment.bookingId);
  if (booking) {
    booking.paymentStatus = finalStatus;
    if (finalStatus === 'PAID') {
      booking.paidAmount = booking.totalAmount;
      booking.balanceAmount = 0;
      payment.paidAmount = payment.amount;
      payment.balanceAmount = 0;
      if (booking.status === 'PENDING') booking.status = 'CONFIRMED';
    } else if (finalStatus === 'PARTIALLY_PAID') {
      const halfOrToken = Math.max(499, Math.round(booking.totalAmount * 0.25));
      booking.paidAmount = halfOrToken;
      booking.balanceAmount = Math.max(0, booking.totalAmount - halfOrToken);
      payment.paidAmount = booking.paidAmount;
      payment.balanceAmount = booking.balanceAmount;
      if (booking.status === 'PENDING') booking.status = 'CONFIRMED';
    }
    await booking.save();

    // If verified to PAID, dispatch updated receipt to customer and admin
    if (finalStatus === 'PAID') {
      try {
        const { dispatchBookingEmails } = require('../utils/mailer');
        const populated = await Booking.findById(booking._id)
          .populate('customerId', 'name email phone')
          .populate('vehicleId')
          .populate('bikeId')
          .populate('driverId')
          .populate('packageId')
          .populate('paymentId');
        dispatchBookingEmails(populated || booking).catch((e) =>
          console.error('Error dispatching invoice on payment approval:', e?.message)
        );
      } catch (e) {
        console.error('Failed to trigger email on payment approval:', e?.message);
      }
    }
  }

  await payment.save();
  return { payment, booking };
}

async function getPaymentDetails(idOrNumber) {
  const isObjectId = mongoose.Types.ObjectId.isValid(idOrNumber);
  const filter = isObjectId
    ? { $or: [{ _id: idOrNumber }, { paymentNumber: idOrNumber }, { transactionId: idOrNumber }] }
    : { $or: [{ paymentNumber: idOrNumber }, { transactionId: idOrNumber }, { bookingNumber: idOrNumber }] };

  const payment = await Payment.findOne(filter)
    .populate('bookingId')
    .populate('customerId', 'name email phone');

  if (!payment) {
    const err = new Error('Payment not found');
    err.statusCode = 404;
    throw err;
  }
  return payment;
}

async function createOfflinePayment(bookingId, customerId, data) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }

  const amount = Number(data.amount || booking.totalAmount || booking.priceBreakdown?.totalAmount || 0);
  const payment = await Payment.create({
    bookingId: booking._id,
    bookingNumber: booking.bookingNumber,
    customerId: customerId || booking.customerId || null,
    guestName: booking.guestName,
    guestPhone: booking.guestPhone,
    guestEmail: booking.guestEmail,
    amount,
    paidAmount: 0,
    balanceAmount: amount,
    method: 'OFFLINE',
    paymentMode: 'offline',
    offlineMethod: data.offlineMethod || 'CASH',
    offlineReference: data.reference,
    verificationNotes: data.notes,
    status: 'OFFLINE_PENDING',
  });

  booking.paymentId = payment._id;
  booking.paymentStatus = 'OFFLINE_PENDING';
  booking.paymentMode = 'offline';
  await booking.save();
  return payment;
}

async function verifyOfflinePayment(paymentId, adminId, data) {
  return updatePaymentStatus(paymentId, data.approve ? 'PAID' : 'FAILED', adminId, data.notes, data.approve);
}

async function initiateRefund(bookingId, amount, reason, adminId) {
  const payment = await Payment.findOne({ bookingId, status: { $in: ['PAID', 'PARTIALLY_PAID'] } });
  if (!payment) {
    const err = new Error('No eligible payment found for this booking to refund');
    err.statusCode = 404;
    throw err;
  }

  const booking = await Booking.findById(bookingId);
  if (booking) {
    booking.paymentStatus = 'REFUNDED';
    await booking.save();
  }

  payment.status = 'REFUNDED';
  payment.refundAmount = amount;
  payment.refundReason = reason;
  payment.refundedAt = new Date();
  await payment.save();

  return payment;
}

async function getPaymentByBooking(bookingId, userId, userRole) {
  const isObjectId = mongoose.Types.ObjectId.isValid(bookingId);
  const filter = isObjectId
    ? { $or: [{ bookingId }, { bookingNumber: bookingId }] }
    : { bookingNumber: bookingId };

  let payment = await Payment.findOne(filter)
    .populate('bookingId')
    .populate('customerId', 'name email phone');

  if (!payment) {
    // Auto-heal: If booking exists, create linked payment
    const bFilter = isObjectId ? { $or: [{ _id: bookingId }, { bookingNumber: bookingId }] } : { bookingNumber: bookingId };
    const booking = await Booking.findOne(bFilter);
    if (booking) {
      const bookingsSvc = require('./bookings.service');
      const synced = await bookingsSvc.getBooking(booking._id, userId, userRole);
      payment = await Payment.findOne({ bookingId: booking._id })
        .populate('bookingId')
        .populate('customerId', 'name email phone');
    }
  }

  if (!payment) {
    const err = new Error('Payment not found for this booking');
    err.statusCode = 404;
    throw err;
  }
  return payment;
}

async function listPayments(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.status && query.status !== 'ALL') filter.status = query.status;
  if (query.method && query.method !== 'ALL') filter.method = query.method;
  if (query.paymentMode && query.paymentMode !== 'ALL') filter.paymentMode = query.paymentMode;
  if (query.customerId) filter.customerId = query.customerId;

  if (query.search || query.q) {
    const s = new RegExp(query.search || query.q, 'i');
    filter.$or = [
      { paymentNumber: s },
      { bookingNumber: s },
      { transactionId: s },
      { guestName: s },
      { guestPhone: s },
      { guestEmail: s },
    ];
  }

  const [payments, total, allPayments] = await Promise.all([
    Payment.find(filter)
      .populate('bookingId', 'bookingNumber serviceType vehicleName pickupDate returnDate status paymentStatus')
      .populate('customerId', 'name email phone')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Payment.countDocuments(filter),
    Payment.find({}, 'amount paidAmount balanceAmount status paymentMode'),
  ]);

  // Dynamic Financial Summary for Admin / Finance Dashboard
  const metrics = {
    totalRevenue: allPayments.reduce((acc, p) => acc + (p.amount || 0), 0),
    totalCollected: allPayments.reduce((acc, p) => acc + (p.paidAmount || 0), 0),
    totalBalanceDue: allPayments.reduce((acc, p) => acc + (p.balanceAmount || 0), 0),
    offlinePendingCount: allPayments.filter((p) => p.status === 'OFFLINE_PENDING').length,
    paidCount: allPayments.filter((p) => p.status === 'PAID').length,
    partialCount: allPayments.filter((p) => p.status === 'PARTIALLY_PAID').length,
  };

  return { payments, pagination: buildPaginationMeta(total, page, limit), metrics };
}

module.exports = {
  processCheckout,
  updatePaymentStatus,
  getPaymentDetails,
  createOnlinePaymentOrder,
  handleWebhook,
  verifyPayment,
  createOfflinePayment,
  verifyOfflinePayment,
  initiateRefund,
  getPaymentByBooking,
  listPayments,
};
