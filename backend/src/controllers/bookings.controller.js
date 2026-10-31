const svc = require('../services/bookings.service');
const { success, created, paginated } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const createSelfDriveCar = asyncHandler(async (req, res) => {
  const booking = await svc.createSelfDriveCar(req.user.id, req.body);
  created(res, booking, 'Booking created');
});

const createSelfDriveBike = asyncHandler(async (req, res) => {
  const booking = await svc.createSelfDriveBike(req.user.id, req.body);
  created(res, booking, 'Booking created');
});

const createCarWithDriver = asyncHandler(async (req, res) => {
  const booking = await svc.createCarWithDriver(req.user.id, req.body);
  created(res, booking, 'Booking created');
});

const createDriverOnly = asyncHandler(async (req, res) => {
  const booking = await svc.createDriverOnly(req.user.id, req.body);
  created(res, booking, 'Booking created');
});

const createTourBooking = asyncHandler(async (req, res) => {
  const booking = await svc.createTourPackageBooking(req.user.id, req.body);
  created(res, booking, 'Booking created');
});

const listBookings = asyncHandler(async (req, res) => {
  const result = await svc.listBookings(req.query, req.user.id, req.user.role);
  return paginated(res, result.bookings, result.pagination, 'Bookings retrieved');
});

const getBooking = asyncHandler(async (req, res) => {
  const booking = await svc.getBooking(req.params.id, req.user.id, req.user.role);
  success(res, booking);
});

const updateStatus = asyncHandler(async (req, res) => {
  const booking = await svc.updateBookingStatus(
    req.params.id,
    req.body.status,
    req.user.id,
    req.user.role,
    req.body.note,
    req.body.paymentStatus
  );
  success(res, booking, 'Status updated');
});

const assignDriver = asyncHandler(async (req, res) => {
  const booking = await svc.assignDriver(req.params.id, req.body.driverId, req.user.id);
  success(res, booking, 'Driver assigned');
});

const pickupInspection = asyncHandler(async (req, res) => {
  const booking = await svc.recordPickupInspection(req.params.id, req.body, req.user.id);
  success(res, booking, 'Pickup inspection recorded');
});

const returnInspection = asyncHandler(async (req, res) => {
  const booking = await svc.recordReturnInspection(req.params.id, req.body, req.user.id);
  success(res, booking, 'Return inspection recorded');
});

const createUniversalBooking = asyncHandler(async (req, res) => {
  const customerId = req.user?.id || null;
  const booking = await svc.createUniversalBooking(customerId, req.body);
  created(res, booking, 'Booking created successfully');
});

const createAdminBooking = asyncHandler(async (req, res) => {
  const booking = await svc.createAdminBooking(req.user, req.body);
  created(res, booking, 'Admin booking created successfully');
});

const getBookingByCode = asyncHandler(async (req, res) => {
  const booking = await svc.getBookingByCode(req.params.code);
  success(res, booking, 'Booking details retrieved');
});

const lookupBookings = asyncHandler(async (req, res) => {
  const query = req.query.query || req.query.q || req.query.phone || req.query.code || '';
  const bookings = await svc.lookupBookings(query);
  success(res, bookings, 'Bookings found');
});

const updateBooking = asyncHandler(async (req, res) => {
  const booking = await svc.updateBooking(req.params.id, req.body, req.user.id, req.user.role);
  success(res, booking, 'Booking updated successfully');
});

const deleteBooking = asyncHandler(async (req, res) => {
  const result = await svc.deleteBooking(req.params.id, req.user.id, req.user.role);
  success(res, result, 'Booking deleted successfully');
});

const getBookingInvoice = asyncHandler(async (req, res) => {
  const identifier = req.params.id || req.params.code;
  const invoiceData = await svc.getBookingInvoice(identifier);
  success(res, invoiceData, 'Booking invoice retrieved successfully');
});

const downloadBookingInvoicePdf = asyncHandler(async (req, res) => {
  const identifier = req.params.code || req.params.id;
  const { Booking } = require('../models/booking.model');
  const mongoose = require('mongoose');

  let booking = null;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    booking = await Booking.findById(identifier);
  }
  if (!booking) {
    booking = await Booking.findOne({
      $or: [
        { bookingNumber: identifier },
        { invoiceNumber: identifier },
        { bookingNumber: new RegExp(`^${identifier}$`, 'i') },
      ],
    });
  }

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking invoice not found' });
  }

  const { generateInvoicePdfBuffer } = require('../utils/pdfInvoiceGenerator');
  const buffer = await generateInvoicePdfBuffer(booking);

  const filename = `Tax_Invoice_${booking.invoiceNumber || booking.bookingNumber}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  return res.send(buffer);
});

const verifyBookingDocuments = asyncHandler(async (req, res) => {
  const booking = await svc.verifyBookingDocuments(req.params.id, req.user?.id, req.body);
  success(res, booking, 'KYC document verification status updated');
});

const attachBookingDocument = asyncHandler(async (req, res) => {
  const booking = await svc.attachBookingDocument(req.params.id, req.user?.id, req.body);
  created(res, booking, 'KYC document attached to booking successfully');
});

const resendBookingEmails = asyncHandler(async (req, res) => {
  const result = await svc.resendBookingEmails(req.params.id, req.body?.email);
  success(res, result, 'Booking confirmation and invoice emails dispatched successfully');
});

module.exports = {
  getBookingInvoice,
  downloadBookingInvoicePdf,
  createUniversalBooking,
  createAdminBooking,
  getBookingByCode,
  lookupBookings,
  createSelfDriveCar,
  createSelfDriveBike,
  createCarWithDriver,
  createDriverOnly,
  createTourBooking,
  listBookings,
  getBooking,
  updateBooking,
  deleteBooking,
  updateStatus,
  assignDriver,
  pickupInspection,
  returnInspection,
  verifyBookingDocuments,
  attachBookingDocument,
  resendBookingEmails,
};

