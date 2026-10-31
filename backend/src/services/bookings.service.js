const mongoose = require('mongoose');
const { Booking } = require('../models/booking.model');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

const ADMIN_ROLES = ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'STAFF_ADMIN', 'ADMIN'];

// Lazy-load models from MVC models
function Vehicle() { return require('../models/vehicle.model').Vehicle; }
function Bike() { return require('../models/bike.model').Bike; }
function Driver() { return require('../models/driver.model').Driver; }
function TourPackage() { return require('../models/package.model').TourPackage; }
function User() { return require('../models/user.model').User; }

// Validate that no overlapping confirmed booking exists for a resource
async function assertNoOverlap(filter) {
  const existing = await Booking.findOne({
    ...filter,
    status: { $in: ['CONFIRMED', 'ASSIGNED', 'ACTIVE'] },
  });
  if (existing) {
    const err = new Error('Resource is already booked for the selected dates');
    err.statusCode = 409;
    throw err;
  }
}

function addStatusHistory(booking, status, changedBy, note) {
  booking.statusHistory.push({
    status,
    changedBy,
    changedAt: new Date(),
    note,
  });
}

// ─── Payment Synchronization & Notifications ──────────────────────────────
const { createOrSyncPaymentForBooking } = require('./bookingPaymentSync');

async function dispatchBookingNotificationsSafely(booking, fallbackEmail = null) {
  try {
    const { dispatchBookingEmails } = require('../utils/mailer');
    let target = booking;
    if (target?._id) {
      try {
        const populated = await Booking.findById(target._id)
          .populate('customerId', 'name email phone')
          .populate('vehicleId')
          .populate('bikeId')
          .populate('driverId')
          .populate('packageId')
          .populate('paymentId');
        if (populated) target = populated;
      } catch (_) {}
    }

    const effectiveFallback =
      fallbackEmail ||
      target?.guestEmail ||
      target?.customerEmail ||
      target?.email ||
      target?.customerId?.email ||
      target?.paymentId?.guestEmail ||
      null;

    setImmediate(() => {
      dispatchBookingEmails(target, effectiveFallback).catch((e) =>
        console.error('[Mailer] Background dispatchBookingEmails error:', e?.message)
      );
    });
  } catch (e) {
    console.error('[Mailer] dispatchBookingNotificationsSafely trigger error:', e?.message);
  }
}

// ─── Self-Drive Car ────────────────────────────────────────────────────────

async function createSelfDriveCar(customerId, data) {
  const vehicle = await Vehicle().findOne({ _id: data.vehicleId, status: 'APPROVED', isPublished: true });
  if (!vehicle || !vehicle.serviceTypes.includes('SELF_DRIVE')) {
    const err = new Error('Vehicle not found or not available for self-drive');
    err.statusCode = 404;
    throw err;
  }

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  if (endDate <= startDate) {
    const err = new Error('End date must be after start date');
    err.statusCode = 400;
    throw err;
  }

  await assertNoOverlap({ vehicleId: data.vehicleId, startDate: { $lt: endDate }, endDate: { $gt: startDate } });

  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 1;
  const baseAmount = days * (vehicle.pricing?.selfDrive?.daily || vehicle.pricePerDay || 0);
  const securityDeposit = vehicle.depositNumeric || vehicle.securityDeposit || 0;
  const taxes = Math.round(baseAmount * 0.18);
  const totalAmount = baseAmount + securityDeposit + taxes;

  const booking = await Booking.create({
    customerId,
    serviceType: 'SELF_DRIVE_CAR',
    vehicleId: vehicle._id,
    vendorId: vehicle.vendorId,
    startDate,
    endDate,
    pickupLocation: data.pickupLocation,
    dropoffLocation: data.dropoffLocation || data.pickupLocation,
    priceBreakdown: { baseAmount, securityDeposit, taxes, totalAmount },
    customerNotes: data.notes,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    statusHistory: [{ status: 'PENDING', changedBy: customerId, changedAt: new Date() }],
  });
  await createOrSyncPaymentForBooking(booking);
  dispatchBookingNotificationsSafely(booking, data.guestEmail || data.email);
  return booking;
}

// ─── Self-Drive Bike ───────────────────────────────────────────────────────

async function createSelfDriveBike(customerId, data) {
  const bike = await Bike().findOne({ _id: data.bikeId, status: 'APPROVED', isPublished: true });
  if (!bike) {
    const err = new Error('Bike not found or not available');
    err.statusCode = 404;
    throw err;
  }

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  if (endDate <= startDate) {
    const err = new Error('End date must be after start date');
    err.statusCode = 400;
    throw err;
  }

  await assertNoOverlap({ bikeId: data.bikeId, startDate: { $lt: endDate }, endDate: { $gt: startDate } });

  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 1;
  const baseAmount = days * (bike.pricing?.daily || bike.pricePerDay || 0);
  const securityDeposit = bike.depositNumeric || bike.pricing?.securityDeposit || 0;
  const taxes = Math.round(baseAmount * 0.18);
  const totalAmount = baseAmount + securityDeposit + taxes;

  const booking = await Booking.create({
    customerId,
    serviceType: 'SELF_DRIVE_BIKE',
    bikeId: bike._id,
    vendorId: bike.vendorId,
    startDate,
    endDate,
    pickupLocation: data.pickupLocation,
    priceBreakdown: { baseAmount, securityDeposit, taxes, totalAmount },
    customerNotes: data.notes,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    statusHistory: [{ status: 'PENDING', changedBy: customerId, changedAt: new Date() }],
  });
  await createOrSyncPaymentForBooking(booking);
  dispatchBookingNotificationsSafely(booking, data.guestEmail || data.email);
  return booking;
}

// ─── Car with Driver ───────────────────────────────────────────────────────

async function createCarWithDriver(customerId, data) {
  const vehicle = await Vehicle().findOne({ _id: data.vehicleId, status: 'APPROVED', isPublished: true });
  if (!vehicle) {
    const err = new Error('Vehicle not found or not available');
    err.statusCode = 404;
    throw err;
  }

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  await assertNoOverlap({ vehicleId: data.vehicleId, startDate: { $lt: endDate }, endDate: { $gt: startDate } });

  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 1;
  const baseAmount = days * (vehicle.pricing?.withDriver?.daily || vehicle.pricePerDay || 2499);
  const taxes = Math.round(baseAmount * 0.18);
  const totalAmount = baseAmount + taxes;

  const booking = await Booking.create({
    customerId,
    serviceType: 'CAR_WITH_DRIVER',
    vehicleId: vehicle._id,
    vendorId: vehicle.vendorId,
    startDate,
    endDate,
    pickupLocation: data.pickupLocation,
    dropoffLocation: data.dropoffLocation,
    priceBreakdown: { baseAmount, taxes, totalAmount },
    customerNotes: data.notes,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    statusHistory: [{ status: 'PENDING', changedBy: customerId, changedAt: new Date() }],
  });
  await createOrSyncPaymentForBooking(booking);
  dispatchBookingNotificationsSafely(booking, data.guestEmail || data.email);
  return booking;
}

// ─── Driver Only ───────────────────────────────────────────────────────────

async function createDriverOnly(customerId, data) {
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) || 1;
  const baseAmount = data.quotedAmount || days * 999;
  const taxes = Math.round(baseAmount * 0.18);
  const totalAmount = baseAmount + taxes;

  const booking = await Booking.create({
    customerId,
    serviceType: 'DRIVER_ONLY',
    quotationId: data.quotationId,
    startDate,
    endDate,
    pickupLocation: data.pickupLocation,
    dropoffLocation: data.dropoffLocation,
    priceBreakdown: { baseAmount, taxes, totalAmount },
    customerNotes: data.notes,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    statusHistory: [{ status: 'PENDING', changedBy: customerId, changedAt: new Date() }],
  });
  await createOrSyncPaymentForBooking(booking);
  dispatchBookingNotificationsSafely(booking, data.guestEmail || data.email);
  return booking;
}

// ─── Tour Package Booking ──────────────────────────────────────────────────

async function createTourPackageBooking(customerId, data) {
  const pkgId = data.packageId || data.vehicleId;
  const pkg = await TourPackage().findOne({
    $or: [{ _id: mongoose.Types.ObjectId.isValid(pkgId) ? pkgId : null }, { slug: pkgId }, { id: pkgId }].filter(Boolean),
    status: 'APPROVED',
  });
  if (!pkg) {
    const err = new Error('Tour package not found');
    err.statusCode = 404;
    throw err;
  }

  const tourDate = data.tourDate || data.startDate || data.pickupDate || new Date();
  const adults = Number(data.adults || data.pax || 2);
  const children = Number(data.children || 0);

  const adultPrice = pkg.pricing?.adultPrice || pkg.priceNumeric || 4999;
  const childPrice = pkg.pricing?.childPrice || Math.round(adultPrice * 0.5);
  const baseAmount = adults * adultPrice + children * childPrice;
  const taxes = Math.round(baseAmount * 0.05);
  const totalAmount = baseAmount + taxes;

  // If availableDates exist, update slot
  if (pkg.availableDates && pkg.availableDates.length > 0) {
    const dateSlot = pkg.availableDates.find(
      (d) => new Date(d.date).toDateString() === new Date(tourDate).toDateString()
    );
    if (dateSlot) {
      await TourPackage().updateOne(
        { _id: pkg._id, 'availableDates._id': dateSlot._id },
        { $inc: { 'availableDates.$.bookedCount': adults + children } }
      );
    }
  }

  const booking = await Booking.create({
    customerId: customerId || null,
    serviceType: 'TOUR_PACKAGE',
    packageId: pkg._id,
    vendorId: pkg.vendorId || null,
    vehicleName: pkg.name || pkg.title,
    vehicleImage: (pkg.images && pkg.images[0]) || pkg.image,
    startDate: new Date(tourDate),
    endDate: new Date(tourDate),
    pickupDate: typeof tourDate === 'string' ? tourDate : new Date(tourDate).toISOString().split('T')[0],
    pickupLocation: data.pickupLocation || pkg.pickupLocation || 'Bhubaneswar',
    dropoffLocation: data.dropoffLocation || pkg.dropLocation || 'Bhubaneswar',
    priceBreakdown: { baseAmount, taxes, totalAmount },
    totalAmount,
    paidAmount: data.paidAmount || 0,
    balanceAmount: totalAmount - (data.paidAmount || 0),
    guestName: data.guestName,
    guestPhone: data.guestPhone,
    guestEmail: data.guestEmail,
    guestNotes: data.notes || data.guestNotes,
    status: 'CONFIRMED',
    paymentStatus: data.paymentStatus || (data.paymentMode === 'offline' ? 'OFFLINE_PENDING' : (data.paidAmount >= totalAmount && totalAmount > 0 ? 'PAID' : 'PENDING')),
    statusHistory: [{ status: 'CONFIRMED', changedBy: customerId || null, changedAt: new Date() }],
  });
  await createOrSyncPaymentForBooking(booking);
  dispatchBookingNotificationsSafely(booking, data.guestEmail || data.email);
  return booking;
}

// ─── Universal Booking (Modal / Checkout) ──────────────────────────────────

async function createUniversalBooking(customerId, data) {
  const payload = {
    customerId: customerId || null,
    ...data,
  };

  // If it is a tour package booking, ensure packageId is set
  if (
    data.serviceType === 'tour-packages' ||
    data.serviceType === 'tour-package' ||
    data.serviceType === 'TOUR_PACKAGE'
  ) {
    if (!payload.packageId && payload.vehicleId) {
      payload.packageId = payload.vehicleId;
    }
  }

  // Validate that booking pick-up / start date is not in the past
  const targetStartDate = payload.pickupDate || payload.startDate;
  if (targetStartDate) {
    const parsedDate = new Date(targetStartDate);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    if (!isNaN(parsedDate.getTime()) && parsedDate < todayMidnight) {
      const err = new Error('Booking pick-up date cannot be in the past. Please select today or a future date.');
      err.statusCode = 400;
      throw err;
    }
  }

  // Ensure total, paid, and balance amounts are properly computed
  const total = Number(payload.totalAmount || payload.priceBreakdown?.totalAmount || 0);
  let paid = Number(payload.paidAmount || 0);
  let balance = payload.balanceAmount !== undefined ? Number(payload.balanceAmount) : Math.max(0, total - paid);

  if (payload.paymentMode === 'full') {
    if (payload.paymentStatus === 'PAID') {
      paid = total;
      balance = 0;
    } else {
      balance = Math.max(0, total - paid);
    }
  } else if (payload.paymentMode === 'offline') {
    paid = 0;
    balance = total;
    if (!payload.paymentStatus || payload.paymentStatus === 'PAID') {
      payload.paymentStatus = 'OFFLINE_PENDING';
    }
  } else if (payload.paymentMode === 'partial') {
    if (!paid) paid = Math.max(499, Math.round(total * 0.25));
    balance = Math.max(0, total - paid);
    if (!payload.paymentStatus) {
      payload.paymentStatus = 'PARTIALLY_PAID';
    }
  }

  payload.totalAmount = total;
  payload.paidAmount = paid;
  payload.balanceAmount = balance;

  // Auto-generate transaction ID if not provided
  if (!payload.transactionId) {
    payload.transactionId = payload.paymentMode === 'offline' 
      ? 'PAY_ON_PICKUP'
      : `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }

  // Resilient lookup separated by service type
  let foundVehicle = null;
  let foundBike = null;
  let foundTour = null;
  let foundDriver = null;

  const rawService = String(payload.serviceType || '').toLowerCase();
  const isBikeBooking = rawService === 'self-drive-bike' || rawService === 'self_drive_bike' || rawService.includes('bike');
  const isTourBooking = rawService === 'tour-packages' || rawService === 'tour-package' || rawService === 'tour_package' || rawService.includes('tour') || rawService.includes('package');
  const isDriverBooking = rawService === 'driver-only' || rawService === 'driver_only' || rawService.includes('driver-only');
  const isCarBooking = !isBikeBooking && !isTourBooking && !isDriverBooking;

  // 1. CAR LOOKUP (Only for self-drive-car and car-with-driver)
  if (isCarBooking) {
    if (payload.vehicleId) {
      if (mongoose.Types.ObjectId.isValid(payload.vehicleId)) {
        foundVehicle = await Vehicle().findById(payload.vehicleId);
      }
      if (!foundVehicle) {
        foundVehicle = await Vehicle().findOne({ $or: [{ id: payload.vehicleId }, { slug: payload.vehicleId }] });
      }
    }
    if (!foundVehicle && payload.vehicleName) {
      const cleanName = payload.vehicleName.replace(/\s*\([^)]*\)/g, '').trim();
      if (cleanName) {
        foundVehicle = await Vehicle().findOne({
          name: { $regex: new RegExp(`^${cleanName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });
      }
    }
    if (foundVehicle) {
      payload.vehicleId = foundVehicle._id;
      const vCount = foundVehicle.quantity ?? foundVehicle.availableCount ?? foundVehicle.specs?.availableUnits ?? foundVehicle.count ?? (foundVehicle.isAvailable !== false ? 1 : 0);
      if (foundVehicle.isAvailable === false || vCount <= 0 || foundVehicle.availabilityStatus === 'UNAVAILABLE' || foundVehicle.availabilityStatus === 'Currently Unavailable') {
        const err = new Error(`${foundVehicle.name || 'Vehicle'} has 0 available units and is currently unavailable.`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  // 2. BIKE LOOKUP (Only for self-drive-bike)
  if (isBikeBooking) {
    const targetBikeId = payload.bikeId || payload.vehicleId;
    if (targetBikeId) {
      if (mongoose.Types.ObjectId.isValid(targetBikeId)) {
        foundBike = await Bike().findById(targetBikeId);
      }
      if (!foundBike) {
        foundBike = await Bike().findOne({ $or: [{ id: targetBikeId }, { slug: targetBikeId }] });
      }
    }
    if (!foundBike && payload.vehicleName) {
      const cleanName = payload.vehicleName.replace(/\s*\([^)]*\)/g, '').trim();
      if (cleanName) {
        foundBike = await Bike().findOne({
          name: { $regex: new RegExp(`^${cleanName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
        });
      }
    }
    if (foundBike) {
      payload.bikeId = foundBike._id;
      delete payload.vehicleId;
      const bCount = foundBike.quantity ?? foundBike.availableCount ?? foundBike.specs?.availableUnits ?? foundBike.count ?? (foundBike.isAvailable !== false ? 1 : 0);
      if (foundBike.isAvailable === false || bCount <= 0 || foundBike.availabilityStatus === 'UNAVAILABLE' || foundBike.availabilityStatus === 'Currently Unavailable') {
        const err = new Error(`${foundBike.name || 'Bike'} has 0 available units and is currently unavailable.`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  // 3. TOUR PACKAGE LOOKUP
  if (isTourBooking) {
    const targetTourId = payload.packageId || payload.vehicleId;
    if (targetTourId) {
      if (mongoose.Types.ObjectId.isValid(targetTourId)) {
        foundTour = await TourPackage().findById(targetTourId);
      }
      if (!foundTour) {
        foundTour = await TourPackage().findOne({ $or: [{ id: targetTourId }, { slug: targetTourId }] });
      }
    }
    if (!foundTour && payload.vehicleName) {
      const cleanName = payload.vehicleName.replace(/\s*\([^)]*\)/g, '').trim();
      if (cleanName) {
        foundTour = await TourPackage().findOne({
          $or: [
            { name: { $regex: new RegExp(`^${cleanName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } },
            { title: { $regex: new RegExp(`^${cleanName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } }
          ]
        });
      }
    }
    if (foundTour) {
      payload.packageId = foundTour._id;
      delete payload.vehicleId;
    }
  }

  // 4. DRIVER LOOKUP
  if (isDriverBooking) {
    const targetDriverId = payload.driverId || payload.vehicleId;
    if (targetDriverId) {
      if (mongoose.Types.ObjectId.isValid(targetDriverId)) {
        foundDriver = await Driver().findById(targetDriverId);
      }
      if (!foundDriver) {
        foundDriver = await Driver().findOne({ $or: [{ id: targetDriverId }, { slug: targetDriverId }] });
      }
    }
    if (foundDriver) {
      payload.driverId = foundDriver._id;
      delete payload.vehicleId;
    }
  }

  // Aggregate all KYC documents into the documents array for Admin Portal viewing
  if (!Array.isArray(payload.documents)) {
    payload.documents = [];
  }
  if (payload.drivingLicenseDoc) {
    const hasDl = payload.documents.some((d) => d.url === payload.drivingLicenseDoc || d.type === 'DRIVING_LICENSE');
    if (!hasDl) {
      payload.documents.unshift({
        name: payload.drivingLicenseDocName || 'Driving License (Front & Back)',
        type: 'DRIVING_LICENSE',
        url: payload.drivingLicenseDoc,
        uploadedAt: new Date(),
      });
    }
  }
  if (payload.idProofDoc) {
    const hasId = payload.documents.some((d) => d.url === payload.idProofDoc || d.type === 'ID_PROOF');
    if (!hasId) {
      payload.documents.push({
        name: payload.idProofDocName || 'Government ID Proof',
        type: 'ID_PROOF',
        url: payload.idProofDoc,
        uploadedAt: new Date(),
      });
    }
  }

  // Calculate and store verified Admin Discount
  try {
    const settingsSvc = require('./settings.service');
    const discountSetting = await settingsSvc.getDiscountSettings();
    if (discountSetting && discountSetting.isActive && discountSetting.percentage > 0) {
      const isEligibleService =
        !discountSetting.applicableServices ||
        discountSetting.applicableServices.length === 0 ||
        discountSetting.applicableServices.includes(payload.serviceType);

      if (isEligibleService) {
        const discountPct = Number(discountSetting.percentage) || 0;
        payload.discountPercentage = discountPct;
        payload.discountCode = discountSetting.badgeText || `${discountPct}% OFF`;

        if (!payload.discountAmount) {
          const base = payload.priceBreakdown?.baseAmount || payload.totalAmount || 0;
          payload.discountAmount = Math.round((base * discountPct) / 100);
        }

        if (payload.priceBreakdown) {
          payload.priceBreakdown.discount = payload.discountAmount;
          payload.priceBreakdown.discountPercentage = discountPct;
        }
      }
    }
  } catch (discErr) {
    console.warn('Discount calculation notice:', discErr.message);
  }

  const booking = await Booking.create(payload);

  // Decrement vehicle inventory count upon booking & invalidate cache
  if (foundVehicle) {
    const current = foundVehicle.quantity ?? foundVehicle.availableCount ?? foundVehicle.specs?.availableUnits ?? foundVehicle.count ?? 1;
    const newCount = Math.max(0, current - 1);
    foundVehicle.quantity = newCount;
    foundVehicle.availableCount = newCount;
    if (!foundVehicle.specs) foundVehicle.specs = {};
    foundVehicle.specs.availableUnits = newCount;
    if (newCount === 0) {
      foundVehicle.isAvailable = false;
      foundVehicle.availabilityStatus = 'Currently Unavailable';
    } else {
      foundVehicle.isAvailable = true;
      foundVehicle.availabilityStatus = 'Available';
    }
    await foundVehicle.save();
    try {
      const { invalidateVehicleCache } = require('./vehicles.service');
      invalidateVehicleCache();
    } catch (_) {}
  }

  // Decrement bike inventory count upon booking & invalidate cache
  if (foundBike) {
    const current = foundBike.quantity ?? foundBike.availableCount ?? foundBike.specs?.availableUnits ?? foundBike.count ?? 1;
    const newCount = Math.max(0, current - 1);
    foundBike.quantity = newCount;
    foundBike.availableCount = newCount;
    if (!foundBike.specs) foundBike.specs = {};
    foundBike.specs.availableUnits = newCount;
    if (newCount === 0) {
      foundBike.isAvailable = false;
      foundBike.availabilityStatus = 'Currently Unavailable';
    } else {
      foundBike.isAvailable = true;
      foundBike.availabilityStatus = 'Available';
    }
    await foundBike.save();
    try {
      const { invalidateBikeCache } = require('./bikes.service');
      invalidateBikeCache();
    } catch (_) {}
  }

  // Dynamically create and link corresponding Payment document
  const payment = await createOrSyncPaymentForBooking(booking);

  const populated = await Booking.findById(booking._id)
    .populate('customerId', 'name email phone')
    .populate('vehicleId')
    .populate('bikeId')
    .populate('driverId')
    .populate('packageId')
    .populate('paymentId');

  // Dispatched booking Tax Invoice & Admin Alert via Nodemailer asynchronously
  const isReal = (em) => em && typeof em === 'string' && em.includes('@') && !em.includes('@offline.carzodrive.com');
  const guestMail = (isReal(payload.guestEmail) ? payload.guestEmail : null) ||
                    (isReal(payload.customerEmail) ? payload.customerEmail : null) ||
                    (isReal(payload.email) ? payload.email : null) ||
                    (isReal(populated?.customerId?.email) ? populated.customerId.email : null) ||
                    null;
  dispatchBookingNotificationsSafely(populated || booking, guestMail);

  return populated || booking;
}

// ─── Admin Manual Booking (Admin books directly for customer / walk-in) ────

async function createAdminBooking(adminUser, data) {
  const {
    customerId,
    customerName,
    customerEmail,
    customerPhone,
    guestName,
    guestEmail,
    guestPhone,
    guestNotes,
    serviceType = 'SELF_DRIVE_CAR',
    vehicleId,
    bikeId,
    driverId,
    packageId,
    userCarModel,
    startDate,
    endDate,
    pickupDate,
    returnDate,
    pickupLocation,
    dropoffLocation,
    days,
    paymentMode = 'offline',
    onlineMethod = 'cash',
    paymentStatus,
    status = 'CONFIRMED',
    transactionId,
    totalAmount,
    paidAmount,
    balanceAmount,
    securityDeposit,
    priceBreakdown,
    adminNotes,
    customerNotes,
  } = data;

  // Helper to safely extract ObjectId string or null
  const normalizeId = (id) =>
    id && typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)
      ? id
      : id && typeof id === 'object' && id._id && mongoose.Types.ObjectId.isValid(id._id)
      ? String(id._id)
      : null;

  const cleanCustomerId = normalizeId(customerId);
  const cleanVehicleId = normalizeId(vehicleId);
  const cleanBikeId = normalizeId(bikeId);
  const cleanDriverId = normalizeId(driverId);
  const cleanPackageId = normalizeId(packageId);

  // Resolve customer details
  let resolvedCustomerId = cleanCustomerId;
  let finalName = (guestName || customerName || '').trim();
  let finalEmail = (guestEmail || customerEmail || '').trim().toLowerCase();
  let finalPhone = (guestPhone || customerPhone || '').trim();

  // If customerId is provided, fetch user if name/email/phone are not explicitly supplied
  if (resolvedCustomerId && (!finalName || !finalEmail || !finalPhone)) {
    try {
      const User = require('../models/user.model').User;
      const foundUser = await User.findById(resolvedCustomerId);
      if (foundUser) {
        if (!finalName) finalName = foundUser.name;
        if (!finalEmail) finalEmail = foundUser.email;
        if (!finalPhone) finalPhone = foundUser.phone;
      }
    } catch {
      // Continue if lookup fails
    }
  }

  // Resolve dates & duration
  const start = startDate ? new Date(startDate) : (pickupDate ? new Date(pickupDate) : new Date());
  let end = endDate ? new Date(endDate) : (returnDate ? new Date(returnDate) : null);
  const numDays = Number(days) || (end ? Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24))) : 1);
  if (!end) {
    end = new Date(start.getTime() + numDays * 24 * 60 * 60 * 1000);
  }

  // Resolve asset snapshots
  let foundVehicle = null;
  let foundBike = null;
  let foundDriver = null;
  let foundPackage = null;
  let resolvedVehicleName = data.vehicleName || '';
  let resolvedVehicleImage = data.vehicleImage || '';

  if (cleanVehicleId) {
    if (mongoose.Types.ObjectId.isValid(cleanVehicleId)) {
      foundVehicle = await Vehicle().findById(cleanVehicleId);
    }
    if (!foundVehicle) {
      foundVehicle = await Vehicle().findOne({ $or: [{ id: cleanVehicleId }, { slug: cleanVehicleId }] });
    }
  }
  if (!foundVehicle && resolvedVehicleName && serviceType !== 'DRIVER_ONLY' && serviceType !== 'TOUR_PACKAGES') {
    const cleanName = resolvedVehicleName.replace(/\s*\([^)]*\)/g, '').trim();
    if (cleanName) {
      foundVehicle = await Vehicle().findOne({
        name: { $regex: new RegExp(`^${cleanName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
      });
    }
  }
  if (foundVehicle) {
    cleanVehicleId = foundVehicle._id;
    resolvedVehicleName = foundVehicle.name;
    resolvedVehicleImage = foundVehicle.images?.[0] || foundVehicle.primaryImage || '';
  }

  if (cleanBikeId) {
    if (mongoose.Types.ObjectId.isValid(cleanBikeId)) {
      foundBike = await Bike().findById(cleanBikeId);
    }
    if (!foundBike) {
      foundBike = await Bike().findOne({ $or: [{ id: cleanBikeId }, { slug: cleanBikeId }] });
    }
  }
  if (!foundBike && resolvedVehicleName && serviceType === 'SELF_DRIVE_BIKE') {
    const cleanName = resolvedVehicleName.replace(/\s*\([^)]*\)/g, '').trim();
    if (cleanName) {
      foundBike = await Bike().findOne({
        name: { $regex: new RegExp(`^${cleanName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
      });
    }
  }
  if (foundBike) {
    cleanBikeId = foundBike._id;
    resolvedVehicleName = foundBike.name;
    resolvedVehicleImage = foundBike.images?.[0] || foundBike.primaryImage || '';
  }

  if (cleanDriverId) {
    foundDriver = await Driver().findById(cleanDriverId);
  }

  if (cleanPackageId) {
    foundPackage = await TourPackage().findById(cleanPackageId);
    if (foundPackage) {
      resolvedVehicleName = foundPackage.title || foundPackage.name;
      resolvedVehicleImage = foundPackage.images?.[0] || '';
    }
  }

  if (!resolvedVehicleName) {
    resolvedVehicleName =
      serviceType === 'DRIVER_ONLY'
        ? userCarModel
          ? `Driver for ${userCarModel}`
          : 'Professional Driver'
        : serviceType === 'SELF_DRIVE_BIKE'
        ? 'Self-Drive Bike'
        : 'Self-Drive Vehicle';
  }

  // Calculate pricing & payments cleanly
  const total = Number(totalAmount) || 0;
  let paid = 0;
  if (paymentMode === 'offline' && paymentStatus !== 'PAID') {
    paid = 0;
  } else if (paidAmount !== undefined && paidAmount !== null && paidAmount !== '') {
    paid = Number(paidAmount);
  } else if (paymentMode === 'full') {
    paid = total;
  } else if (paymentMode === 'partial') {
    paid = Math.max(499, Math.round(total * 0.25));
  } else {
    paid = 0;
  }

  const balance =
    balanceAmount !== undefined && balanceAmount !== null && balanceAmount !== ''
      ? (paymentMode === 'offline' && paymentStatus !== 'PAID' && Number(balanceAmount) === 0 && total > 0 ? total : Number(balanceAmount))
      : Math.max(0, total - paid);

  let finalPaymentStatus = paymentStatus;
  if (!finalPaymentStatus) {
    if (paid >= total && total > 0) finalPaymentStatus = 'PAID';
    else if (paid > 0 && paid < total) finalPaymentStatus = 'PARTIALLY_PAID';
    else if (paymentMode === 'offline') finalPaymentStatus = 'OFFLINE_PENDING';
    else finalPaymentStatus = 'PENDING';
  }

  const finalTxnId =
    transactionId ||
    (paymentMode === 'offline'
      ? `ADMIN-CASH-${Date.now().toString(36).toUpperCase()}`
      : `ADMIN-TXN-${Date.now().toString(36).toUpperCase()}`);

  const adminId = adminUser?._id || adminUser?.id;
  const changedBy = adminId && mongoose.Types.ObjectId.isValid(adminId) ? adminId : null;
  const adminLabel = adminUser?.name || adminUser?.email || 'Admin';

  const bookingPayload = {
    customerId: resolvedCustomerId,
    guestName: finalName || 'Valued Customer',
    guestEmail: finalEmail || '',
    guestPhone: finalPhone || '',
    guestNotes: guestNotes || customerNotes || '',
    userCarModel: userCarModel || '',
    serviceType,
    vehicleId: cleanVehicleId,
    bikeId: cleanBikeId,
    driverId: cleanDriverId,
    packageId: cleanPackageId,
    vehicleName: resolvedVehicleName,
    vehicleImage: resolvedVehicleImage,
    pickupLocation: pickupLocation || 'SUM Hospital Hub',
    dropoffLocation: dropoffLocation || pickupLocation || 'Same as Pick-up Address',
    startDate: start,
    endDate: end,
    pickupDate: pickupDate || start.toISOString().split('T')[0],
    returnDate: returnDate || end.toISOString().split('T')[0],
    days: numDays,
    paymentMode,
    onlineMethod,
    transactionId: finalTxnId,
    totalAmount: total,
    paidAmount: paid,
    balanceAmount: balance,
    securityDeposit: Number(securityDeposit) || 0,
    priceBreakdown: priceBreakdown || {
      baseAmount: Math.max(0, total - (Number(securityDeposit) || 0)),
      securityDeposit: Number(securityDeposit) || 0,
      taxes: 0,
      extraCharges: 0,
      protectionFee: 0,
      totalAmount: total,
    },
    status: status || 'CONFIRMED',
    paymentStatus: finalPaymentStatus,
    customerNotes: customerNotes || '',
    adminNotes: adminNotes || `Booked manually by Admin: ${adminLabel}`,
    statusHistory: [
      {
        status: status || 'CONFIRMED',
        changedBy,
        changedAt: new Date(),
        note: `Manual booking created by Admin (${adminLabel})`,
      },
    ],
  };

  const booking = await Booking.create(bookingPayload);

  // Decrement fleet inventory safely
  if (foundVehicle) {
    try {
      const current = foundVehicle.quantity ?? foundVehicle.availableCount ?? foundVehicle.specs?.availableUnits ?? foundVehicle.count ?? 1;
      const newCount = Math.max(0, current - 1);
      foundVehicle.quantity = newCount;
      foundVehicle.availableCount = newCount;
      if (!foundVehicle.specs) foundVehicle.specs = {};
      foundVehicle.specs.availableUnits = newCount;
      if (newCount === 0) {
        foundVehicle.isAvailable = false;
        foundVehicle.availabilityStatus = 'Currently Unavailable';
      }
      await foundVehicle.save();
      try {
        const { invalidateVehicleCache } = require('./vehicles.service');
        invalidateVehicleCache();
      } catch (_) {}
    } catch (vErr) {
      console.warn('Inventory decrement notice (vehicle):', vErr.message);
    }
  }

  if (foundBike) {
    try {
      const current = foundBike.quantity ?? foundBike.availableCount ?? foundBike.specs?.availableUnits ?? foundBike.count ?? 1;
      const newCount = Math.max(0, current - 1);
      foundBike.quantity = newCount;
      foundBike.availableCount = newCount;
      if (!foundBike.specs) foundBike.specs = {};
      foundBike.specs.availableUnits = newCount;
      if (newCount === 0) {
        foundBike.isAvailable = false;
        foundBike.availabilityStatus = 'Currently Unavailable';
      }
      await foundBike.save();
      try {
        const { invalidateBikeCache } = require('./bikes.service');
        invalidateBikeCache();
      } catch (_) {}
    } catch (bErr) {
      console.warn('Inventory decrement notice (bike):', bErr.message);
    }
  }

  // Create & link Payment record (respecting custom paid/balance amounts)
  try {
    await createOrSyncPaymentForBooking(booking);
  } catch (payErr) {
    console.warn('Payment sync notice during admin booking:', payErr.message);
  }

  // Fetch populated booking safely
  let populated = booking;
  try {
    populated = await Booking.findById(booking._id)
      .populate('customerId', 'name email phone')
      .populate('paymentId');
  } catch (popErr) {
    console.warn('Populate notice in createAdminBooking:', popErr.message);
    populated = booking;
  }

  // Dispatch background notification without blocking response
  const isReal = (em) => em && typeof em === 'string' && em.includes('@') && !em.includes('@offline.carzodrive.com');
  const targetMail = (isReal(finalEmail) ? finalEmail : null) || (isReal(populated?.customerId?.email) ? populated.customerId.email : null);
  dispatchBookingNotificationsSafely(populated || booking, targetMail);

  return populated || booking;
}


// ─── Get & List Bookings ───────────────────────────────────────────────────

async function getBooking(bookingId, userId, userRole) {
  let booking = null;
  if (mongoose.Types.ObjectId.isValid(bookingId)) {
    booking = await Booking.findById(bookingId)
      .populate('customerId', 'name email phone')
      .populate('vehicleId')
      .populate('bikeId')
      .populate('driverId')
      .populate('packageId')
      .populate('paymentId');
  }
  if (!booking) {
    booking = await Booking.findOne({ bookingNumber: bookingId })
      .populate('customerId', 'name email phone')
      .populate('vehicleId')
      .populate('bikeId')
      .populate('driverId')
      .populate('packageId')
      .populate('paymentId');
  }
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }

  // Auto-heal payment link if legacy booking didn't have one
  if (!booking.paymentId) {
    await createOrSyncPaymentForBooking(booking);
    booking = await Booking.findById(booking._id)
      .populate('customerId', 'name email phone')
      .populate('vehicleId')
      .populate('bikeId')
      .populate('driverId')
      .populate('packageId')
      .populate('paymentId');
  }

  return booking;
}

async function listBookings(query, userId, userRole) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  const andClauses = [];

  if (!ADMIN_ROLES.includes(userRole)) {
    if (userRole === 'VENDOR') {
      filter.vendorId = query.vendorId || userId;
    } else {
      const userConditions = [{ customerId: userId }];
      try {
        const user = await User().findById(userId).lean();
        if (user?.email) {
          userConditions.push({ guestEmail: new RegExp(`^${user.email.trim()}$`, 'i') });
        }
        if (user?.phone) {
          const digits = user.phone.replace(/[^0-9]/g, '').slice(-10);
          if (digits.length >= 6) {
            userConditions.push({ guestPhone: new RegExp(digits, 'i') });
          }
        }
      } catch (_) {}
      andClauses.push({ $or: userConditions });
    }
  }

  if (query.status && query.status !== 'ALL') filter.status = query.status;
  if (query.serviceType && query.serviceType !== 'ALL') filter.serviceType = query.serviceType;
  if (query.paymentStatus && query.paymentStatus !== 'ALL') filter.paymentStatus = query.paymentStatus;
  if (query.paymentMode && query.paymentMode !== 'ALL') filter.paymentMode = query.paymentMode;

  if (query.search || query.q) {
    const s = new RegExp(query.search || query.q, 'i');
    andClauses.push({
      $or: [
        { bookingNumber: s },
        { guestName: s },
        { guestPhone: s },
        { guestEmail: s },
        { vehicleName: s },
        { transactionId: s },
      ],
    });
  }

  if (andClauses.length > 0) {
    filter.$and = andClauses;
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('customerId', 'name email phone')
      .populate('vehicleId', 'name make model brand image')
      .populate('bikeId', 'name make model brand image')
      .populate('driverId', 'name phone')
      .populate('packageId', 'name title image')
      .populate('paymentId')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    Booking.countDocuments(filter),
  ]);
  return { bookings, pagination: buildPaginationMeta(total, page, limit) };
}

// ─── Status Update ─────────────────────────────────────────────────────────

const TRANSITIONS = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['ASSIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
  ASSIGNED: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

async function updateBookingStatus(bookingId, newStatus, userId, userRole, note, paymentStatus) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }

  const isAdmin = ADMIN_ROLES.includes(userRole);
  const allowed = TRANSITIONS[booking.status] || [];
  if (!isAdmin && !allowed.includes(newStatus)) {
    const err = new Error(`Cannot transition from ${booking.status} to ${newStatus}`);
    err.statusCode = 400;
    throw err;
  }

  booking.status = newStatus;
  if (paymentStatus) {
    booking.paymentStatus = paymentStatus;
    if (paymentStatus === 'PAID') {
      booking.paidAmount = booking.totalAmount || booking.paidAmount;
      booking.balanceAmount = 0;
    }
  }
  addStatusHistory(booking, newStatus, userId, note);
  await booking.save();

  // Restore inventory if booking was cancelled
  if (newStatus === 'CANCELLED') {
    if (booking.vehicleId) {
      const v = await Vehicle().findById(booking.vehicleId);
      if (v) {
        const nextVal = (v.quantity !== undefined ? v.quantity : (v.availableCount || 0)) + 1;
        v.quantity = nextVal;
        v.availableCount = nextVal;
        if (!v.specs) v.specs = {};
        v.specs.availableUnits = nextVal;
        v.isAvailable = true;
        v.availabilityStatus = 'Available';
        await v.save();
        try {
          const { invalidateVehicleCache } = require('./vehicles.service');
          invalidateVehicleCache();
        } catch (_) {}
      }
    }
    if (booking.bikeId) {
      const b = await Bike().findById(booking.bikeId);
      if (b) {
        const nextVal = (b.quantity !== undefined ? b.quantity : (b.availableCount || 0)) + 1;
        b.quantity = nextVal;
        b.availableCount = nextVal;
        if (!b.specs) b.specs = {};
        b.specs.availableUnits = nextVal;
        b.isAvailable = true;
        b.availabilityStatus = 'Available';
        await b.save();
        try {
          const { invalidateBikeCache } = require('./bikes.service');
          invalidateBikeCache();
        } catch (_) {}
      }
    }
  }

  // Dynamically sync linked Payment record
  await createOrSyncPaymentForBooking(booking);

  const updated = await Booking.findById(booking._id)
    .populate('customerId', 'name email phone')
    .populate('vehicleId')
    .populate('bikeId')
    .populate('driverId')
    .populate('packageId')
    .populate('paymentId');

  const customerEmail = updated?.guestEmail || updated?.customerEmail || updated?.customerId?.email;
  dispatchBookingNotificationsSafely(updated || booking, customerEmail);
  return updated || booking;
}


async function assignDriver(bookingId, driverId, adminId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }
  const driver = await Driver().findOne({ _id: driverId, status: 'APPROVED' });
  if (!driver) {
    const err = new Error('Driver not available');
    err.statusCode = 404;
    throw err;
  }

  booking.driverId = driverId;
  booking.status = 'ASSIGNED';
  addStatusHistory(booking, 'ASSIGNED', adminId, `Driver ${driver.name} assigned`);
  await booking.save();
  return booking;
}

async function getBookingByCode(bookingCode) {
  const isObjectId = mongoose.Types.ObjectId.isValid(bookingCode);
  const filter = isObjectId
    ? { $or: [{ bookingNumber: bookingCode }, { _id: bookingCode }] }
    : { bookingNumber: bookingCode };

  let booking = await Booking.findOne(filter)
    .populate('customerId', 'name email phone')
    .populate('vehicleId')
    .populate('bikeId')
    .populate('driverId')
    .populate('packageId')
    .populate('paymentId');

  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }

  // Auto-heal payment link if not present
  if (!booking.paymentId) {
    await createOrSyncPaymentForBooking(booking);
    booking = await Booking.findById(booking._id)
      .populate('customerId', 'name email phone')
      .populate('vehicleId')
      .populate('bikeId')
      .populate('driverId')
      .populate('packageId')
      .populate('paymentId');
  }

  return booking;
}

async function lookupBookings(queryInput) {
  let searchStr = '';
  let phone = '';
  let email = '';
  let code = '';

  if (typeof queryInput === 'string') {
    searchStr = queryInput.trim();
  } else if (queryInput && typeof queryInput === 'object') {
    searchStr = (queryInput.query || queryInput.q || '').trim();
    phone = (queryInput.phone || '').trim();
    email = (queryInput.email || '').trim();
    code = (queryInput.code || '').trim();
  }

  const conditions = [];

  // 1. Explicit phone or query containing phone
  const targetPhone = phone || searchStr;
  const cleanDigits = targetPhone.replace(/[^0-9]/g, '');
  if (cleanDigits.length >= 10) {
    const tenDigit = cleanDigits.slice(-10);
    conditions.push({ guestPhone: new RegExp(tenDigit, 'i') });
  } else if (cleanDigits.length >= 6 && !searchStr.includes('@') && !searchStr.toUpperCase().startsWith('CZ')) {
    conditions.push({ guestPhone: new RegExp(cleanDigits, 'i') });
  }

  // 2. Explicit email or search containing @
  const targetEmail = email || (searchStr.includes('@') ? searchStr : '');
  if (targetEmail) {
    conditions.push({ guestEmail: new RegExp(`^${targetEmail.toLowerCase().trim()}$`, 'i') });
  }

  // 3. Explicit code / transaction ID or general search
  const targetCode = code || searchStr;
  if (targetCode) {
    const escaped = targetCode.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    conditions.push({ bookingNumber: new RegExp(escaped, 'i') });
    conditions.push({ transactionId: new RegExp(escaped, 'i') });
    if (!targetCode.includes('@') && cleanDigits.length < 10) {
      conditions.push({ guestName: new RegExp(escaped, 'i') });
    }
  }

  if (conditions.length === 0) {
    return [];
  }

  const filter = { $or: conditions };
  const bookings = await Booking.find(filter)
    .populate('customerId', 'name email phone')
    .populate('vehicleId', 'name make model brand image')
    .populate('bikeId', 'name make model brand image')
    .populate('driverId', 'name phone')
    .populate('packageId', 'name title image')
    .populate('paymentId')
    .sort({ createdAt: -1 })
    .limit(20);

  // Auto-heal payment links for returned bookings
  for (const b of bookings) {
    if (!b.paymentId) {
      createOrSyncPaymentForBooking(b).catch(() => {});
    }
  }

  return bookings;
}

async function updateBooking(bookingId, updateData) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }
  Object.assign(booking, updateData);
  await booking.save();

  // Dynamically sync linked Payment record
  await createOrSyncPaymentForBooking(booking);

  const updated = await Booking.findById(booking._id)
    .populate('customerId', 'name email phone')
    .populate('vehicleId')
    .populate('bikeId')
    .populate('driverId')
    .populate('packageId')
    .populate('paymentId');

  if (updateData.status || updateData.paymentStatus) {
    const customerEmail = updated?.guestEmail || updated?.customerEmail || updated?.customerId?.email;
    dispatchBookingNotificationsSafely(updated || booking, customerEmail);
  }

  return updated || booking;
}

async function deleteBooking(bookingId) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }

  // Restore inventory if booking is deleted and wasn't already cancelled or completed
  if (booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED') {
    if (booking.vehicleId) {
      const v = await Vehicle().findById(booking.vehicleId);
      if (v) {
        const nextVal = (v.quantity !== undefined ? v.quantity : (v.availableCount || 0)) + 1;
        v.quantity = nextVal;
        v.availableCount = nextVal;
        if (!v.specs) v.specs = {};
        v.specs.availableUnits = nextVal;
        v.isAvailable = true;
        v.availabilityStatus = 'Available';
        await v.save();
        try {
          const { invalidateVehicleCache } = require('./vehicles.service');
          invalidateVehicleCache();
        } catch (_) {}
      }
    }
    if (booking.bikeId) {
      const b = await Bike().findById(booking.bikeId);
      if (b) {
        const nextVal = (b.quantity !== undefined ? b.quantity : (b.availableCount || 0)) + 1;
        b.quantity = nextVal;
        b.availableCount = nextVal;
        if (!b.specs) b.specs = {};
        b.specs.availableUnits = nextVal;
        b.isAvailable = true;
        b.availabilityStatus = 'Available';
        await b.save();
        try {
          const { invalidateBikeCache } = require('./bikes.service');
          invalidateBikeCache();
        } catch (_) {}
      }
    }
  }

  const PaymentModel = require('../models/payment.model').Payment;
  await PaymentModel.deleteMany({ bookingId: booking._id });
  await Booking.findByIdAndDelete(bookingId);
  return { message: 'Booking and linked payment record deleted successfully' };
}

const COMPANY_INVOICE_DETAILS = {
  legalName: 'CARZODRIVE LUXURY MOBILITY & TOURS PRIVATE LIMITED',
  tradeName: 'CARZODRIVE',
  address: 'Plot No. 42, Airport Square, Master Canteen, Bhubaneswar, Odisha - 751001, India',
  gstin: '21AAACC1234D1Z5',
  cin: 'U50100OR2026PTC045812',
  pan: 'AAACC1234D',
  state: 'Odisha',
  stateCode: '21',
  supportPhone: '+91 79780 00000',
  supportEmail: 'concierge@carzodrive.com',
  website: 'https://carzodrive.com',
  sacCarRental: '996411',
  sacTourOperator: '998553',
};

async function getBookingInvoice(identifier) {
  let booking = null;
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    booking = await Booking.findById(identifier)
      .populate('customerId', 'name email phone')
      .populate('vehicleId')
      .populate('bikeId')
      .populate('driverId')
      .populate('packageId')
      .populate('paymentId');
  }
  if (!booking) {
    booking = await Booking.findOne({
      $or: [
        { bookingNumber: identifier },
        { invoiceNumber: identifier },
        { transactionId: identifier },
      ],
    })
      .populate('customerId', 'name email phone')
      .populate('vehicleId')
      .populate('bikeId')
      .populate('driverId')
      .populate('packageId')
      .populate('paymentId');
  }

  if (!booking) {
    const err = new Error('Booking invoice not found');
    err.statusCode = 404;
    throw err;
  }

  if (!booking.invoiceNumber && booking.bookingNumber) {
    booking.invoiceNumber = `INV-${booking.bookingNumber.replace(/^CZ-/, '')}`;
    await booking.save();
  }

  return {
    company: COMPANY_INVOICE_DETAILS,
    invoiceNumber: booking.invoiceNumber || `INV-${booking.bookingNumber?.replace(/^CZ-/, '') || booking._id}`,
    invoiceDate: booking.invoiceDate || booking.createdAt || new Date(),
    booking,
  };
}

// ─── KYC Document Verification & Management ────────────────────────────────

async function verifyBookingDocuments(bookingId, adminUserId, data = {}) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }

  const verified = data.verified !== false;
  booking.documentsVerified = verified;
  booking.documentsVerifiedAt = new Date();
  booking.documentsVerifiedBy = adminUserId || null;
  if (data.notes !== undefined) {
    booking.documentsVerificationNotes = data.notes;
  }

  addStatusHistory(
    booking,
    booking.status,
    adminUserId,
    verified ? 'KYC documents verified and approved by admin' : 'KYC documents flagged / unverified by admin'
  );

  await booking.save();
  return booking;
}

async function attachBookingDocument(bookingId, adminUserId, data = {}) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }

  if (!data.url) {
    const err = new Error('Document URL is required');
    err.statusCode = 400;
    throw err;
  }

  const newDoc = {
    name: data.name || 'Verification Document',
    type: data.type || 'ID_PROOF',
    url: data.url,
    uploadedAt: new Date(),
  };

  if (!Array.isArray(booking.documents)) {
    booking.documents = [];
  }
  booking.documents.push(newDoc);

  if (data.type === 'DRIVING_LICENSE' && !booking.drivingLicenseDoc) {
    booking.drivingLicenseDoc = data.url;
  }
  if (data.type === 'ID_PROOF' && !booking.idProofDoc) {
    booking.idProofDoc = data.url;
  }

  addStatusHistory(booking, booking.status, adminUserId, `Document "${newDoc.name}" attached by admin`);
  await booking.save();
  return booking;
}

async function resendBookingEmails(bookingIdOrCode, overrideEmail = null) {
  let booking = null;
  if (mongoose.Types.ObjectId.isValid(bookingIdOrCode)) {
    booking = await Booking.findById(bookingIdOrCode)
      .populate('customerId', 'name email phone')
      .populate('vehicleId')
      .populate('bikeId')
      .populate('driverId')
      .populate('packageId')
      .populate('paymentId');
  }
  if (!booking) {
    booking = await Booking.findOne({
      $or: [
        { bookingNumber: bookingIdOrCode },
        { invoiceNumber: bookingIdOrCode },
      ],
    })
      .populate('customerId', 'name email phone')
      .populate('vehicleId')
      .populate('bikeId')
      .populate('driverId')
      .populate('packageId')
      .populate('paymentId');
  }
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }

  const { dispatchBookingEmails } = require('../utils/mailer');
  const results = await dispatchBookingEmails(booking, overrideEmail);
  return { success: true, bookingNumber: booking.bookingNumber, results };
}

module.exports = {
  COMPANY_INVOICE_DETAILS,
  getBookingInvoice,
  createSelfDriveCar,
  createSelfDriveBike,
  createCarWithDriver,
  createDriverOnly,
  createTourPackageBooking,
  createUniversalBooking,
  createAdminBooking,
  getBooking,
  listBookings,
  updateBookingStatus,
  assignDriver,
  getBookingByCode,
  lookupBookings,
  updateBooking,
  deleteBooking,
  verifyBookingDocuments,
  attachBookingDocument,
  resendBookingEmails,
  dispatchBookingNotificationsSafely,
};

