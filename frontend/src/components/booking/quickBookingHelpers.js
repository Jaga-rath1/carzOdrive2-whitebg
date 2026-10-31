import { resolveVehicleImageUrl } from '../../utils/documentUtils';

export const normalizeServiceType = (rawService, item = null) => {
  const s = String(rawService || '').toLowerCase().trim();
  if (s === 'self-drive-bike' || s.includes('bike') || s.includes('two-wheeler')) return 'self-drive-bike';
  if (s === 'car-with-driver' || s.includes('chauffeur') || s.includes('with-driver')) return 'car-with-driver';
  if (s === 'driver-only' || s.includes('driver')) return 'driver-only';
  if (s === 'tour-packages' || s.includes('tour') || s.includes('package')) return 'tour-packages';
  if (s === 'self-drive-car' || s.includes('self-drive') || s.includes('car')) return 'self-drive-car';

  if (item) {
    const vType = String(item.vehicleType || '').toLowerCase();
    const cat = String(item.category || '').toLowerCase();
    if (item.bikeType || vType === 'bike' || cat === 'bike' || cat === 'scooter' || cat === 'sports' || cat === 'commuter') return 'self-drive-bike';
    if (item.durationDays || item.itinerary || item.startingPrice) return 'tour-packages';
    if (item.dailyRate || item.experienceYears) return 'driver-only';
  }
  return 'self-drive-car';
};

export const resolveBookingItemDetails = ({
  selectedService,
  selectedCar,
  selectedChauffeurCar,
  selectedDriver,
  selectedBike,
  selectedTour,
  dbCars = [],
  dbDrivers = [],
  dbBikes = [],
  dbTours = [],
}) => {
  const fallbackCar = dbCars.find((c) => c.isAvailable && (c.availableCount > 0 || c.quantity > 0)) || dbCars.find((c) => c.isAvailable) || dbCars[0];
  const fallbackBike = dbBikes.find((b) => b.isAvailable && (b.availableCount > 0 || b.quantity > 0)) || dbBikes.find((b) => b.isAvailable) || dbBikes[0];
  const fallbackTour = dbTours.find((t) => t.isAvailable) || dbTours[0];
  const fallbackDriver = dbDrivers.find((d) => d.isAvailable !== false) || dbDrivers[0];

  switch (selectedService) {
    case 'car-with-driver': {
      const car = selectedChauffeurCar || fallbackCar;
      const rawPricing = car?.rawVehicle?.pricing?.withDriver?.daily;
      const fallbackPrice = car?.priceNumeric ? car.priceNumeric + 700 : 3499;
      return {
        currentItemName: car?.name ? `${car.name} (with Driver)` : 'Executive Car (with Driver)',
        currentItemImage: resolveVehicleImageUrl(car?.image, 'https://res.cloudinary.com/gjjtie9o/image/upload/v1792779598/carzodrive/cars/car-main-1792779591435-ee911a8b.jpg'),
        ratePerDay: rawPricing || fallbackPrice,
        deposit: '₹0 (Zero Deposit)',
        isAvailable: car?.isAvailable !== false && (car?.availableCount ?? car?.quantity ?? 1) > 0 && car?.availabilityStatus !== 'UNAVAILABLE' && car?.availabilityStatus !== 'Currently Unavailable',
      };
    }
    case 'driver-only': {
      const driver = selectedDriver || fallbackDriver;
      return {
        currentItemName: driver?.name ? `${driver.name} (Verified Commercial Pilot)` : 'Verified Driver (Provided by Company)',
        currentItemImage: driver?.image || driver?.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop',
        ratePerDay: driver?.dailyRate || 799,
        deposit: '₹0 (Zero Deposit)',
        isAvailable: true,
      };
    }
    case 'self-drive-bike': {
      const bike = selectedBike || fallbackBike;
      const parsed = typeof bike?.pricePerDay === 'number'
        ? bike.pricePerDay
        : parseInt(String(bike?.pricePerDay || '1299').replace(/[^0-9]/g, ''), 10) || 1299;
      return {
        currentItemName: bike?.name || 'Self-Drive Two-Wheeler',
        currentItemImage: resolveVehicleImageUrl(bike?.image, 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793262291/carzodrive/bikes/bike-main-1793262290712-a8c0708c.jpg'),
        ratePerDay: parsed,
        deposit: bike?.deposit || '₹2,000',
        isAvailable: bike?.isAvailable !== false && (bike?.availableCount ?? bike?.quantity ?? 1) > 0 && bike?.availabilityStatus !== 'UNAVAILABLE' && bike?.availabilityStatus !== 'Currently Unavailable',
      };
    }
    case 'tour-packages': {
      const tour = selectedTour || fallbackTour;
      const parsed = typeof tour?.priceNumeric === 'number'
        ? tour.priceNumeric
        : parseInt(String(tour?.startingPrice || '5499').replace(/[^0-9]/g, ''), 10) || 5499;
      return {
        currentItemName: tour?.title || tour?.name || 'Bhubaneswar Heritage Escape',
        currentItemImage: resolveVehicleImageUrl(tour?.image, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1000&auto=format&fit=crop'),
        ratePerDay: parsed,
        deposit: '₹0 (Zero Deposit)',
        isAvailable: true,
      };
    }
    case 'self-drive-car':
    default: {
      const car = selectedCar || fallbackCar;
      let rate = 2999;
      if (typeof car?.priceNumeric === 'number' && car.priceNumeric > 0) {
        rate = car.priceNumeric;
      } else if (typeof car?.pricePerDay === 'string') {
        const parsed = parseInt(car.pricePerDay.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed) && parsed > 0) rate = parsed;
      } else if (typeof car?.pricePerDay === 'number' && car.pricePerDay > 0) {
        rate = car.pricePerDay < 1000 ? car.pricePerDay * 80 : car.pricePerDay;
      }
      return {
        currentItemName: car?.name || 'Swift 2026',
        currentItemImage: resolveVehicleImageUrl(car?.image, 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793001974/carzodrive/cars/car-main-1793001972073-6c682a6c.jpg'),
        ratePerDay: rate,
        deposit: car?.depositNumeric ? `₹${car.depositNumeric}` : (car?.deposit || '₹5,000'),
        isAvailable: car?.isAvailable !== false && (car?.availableCount ?? car?.quantity ?? 1) > 0 && car?.availabilityStatus !== 'UNAVAILABLE' && car?.availabilityStatus !== 'Currently Unavailable',
      };
    }
  }
};

export const getActiveVehicleId = ({
  selectedService,
  selectedCar,
  selectedChauffeurCar,
  selectedBike,
  selectedTour,
  selectedDriver,
  initialVehicle,
}) => {
  if (selectedService === 'self-drive-car') {
    return selectedCar?._id || selectedCar?.rawId || selectedCar?.id || initialVehicle?._id || initialVehicle?.rawId || initialVehicle?.id;
  }
  if (selectedService === 'car-with-driver') {
    return selectedChauffeurCar?._id || selectedChauffeurCar?.rawId || selectedChauffeurCar?.id || selectedCar?._id || selectedCar?.rawId || selectedCar?.id || initialVehicle?._id || initialVehicle?.rawId || initialVehicle?.id;
  }
  if (selectedService === 'self-drive-bike') {
    return selectedBike?._id || selectedBike?.rawId || selectedBike?.id || initialVehicle?._id || initialVehicle?.rawId || initialVehicle?.id;
  }
  if (selectedService === 'tour-packages') {
    return selectedTour?._id || selectedTour?.rawId || selectedTour?.packageId || selectedTour?.id;
  }
  if (selectedService === 'driver-only') {
    return selectedDriver?._id || selectedDriver?.rawId || selectedDriver?.id || initialVehicle?._id || initialVehicle?.rawId || initialVehicle?.id || 'driver-company';
  }
  return selectedCar?._id || selectedCar?.rawId || selectedCar?.id || initialVehicle?._id || initialVehicle?.rawId || initialVehicle?.id;
};

export const buildCheckoutPayload = ({
  selectedService,
  guestName,
  guestPhone,
  guestEmail,
  guestNotes,
  userCarModel,
  activeVehicleId,
  selectedTour,
  currentItemName,
  currentItemImage,
  effectivePickupLocation,
  effectiveDropoffLocation,
  pickupDate,
  returnDate,
  days,
  includeProtection,
  paymentMode,
  onlineMethod,
  upiApp,
  total,
  amountDueNow,
  amountDueAtPickup,
  deposit,
  drivingLicenseNumber,
  drivingLicenseDoc,
  drivingLicenseDocName,
  idProofDoc,
  idProofDocName,
  discountPercentage = 0,
  discountAmount = 0,
  discountCode = '',
  subtotal = 0,
  insuranceCost = 0,
}) => {
  const isCar = selectedService === 'self-drive-car' || selectedService === 'car-with-driver';
  const isBike = selectedService === 'self-drive-bike';
  const isDriver = selectedService === 'driver-only';
  const isTour = selectedService === 'tour-packages';

  const documents = [];
  if (drivingLicenseDoc) {
    documents.push({
      name: drivingLicenseDocName || 'Driving License (Front & Back)',
      type: 'DRIVING_LICENSE',
      url: drivingLicenseDoc,
      uploadedAt: new Date().toISOString(),
    });
  }
  if (idProofDoc) {
    documents.push({
      name: idProofDocName || 'Government ID Proof',
      type: 'ID_PROOF',
      url: idProofDoc,
      uploadedAt: new Date().toISOString(),
    });
  }

  return {
    serviceType: selectedService,
    guestName: guestName.trim(),
    guestPhone: guestPhone.trim(),
    guestEmail: guestEmail.trim() || undefined,
    guestNotes: guestNotes.trim(),
    drivingLicenseNumber: drivingLicenseNumber?.trim() || undefined,
    drivingLicenseDoc: drivingLicenseDoc || undefined,
    drivingLicenseDocName: drivingLicenseDocName || undefined,
    idProofDoc: idProofDoc || undefined,
    idProofDocName: idProofDocName || undefined,
    documents,
    userCarModel: userCarModel?.trim() || undefined,
    vehicleId: isCar ? activeVehicleId : undefined,
    bikeId: isBike ? activeVehicleId : undefined,
    driverId: isDriver ? activeVehicleId : undefined,
    packageId: isTour ? (selectedTour?._id || selectedTour?.packageId || selectedTour?.id || activeVehicleId) : undefined,
    tourDate: isTour ? pickupDate : undefined,
    vehicleName: userCarModel ? `${currentItemName} (Client Car: ${userCarModel})` : currentItemName,
    vehicleImage: currentItemImage,
    pickupLocation: effectivePickupLocation,
    dropoffLocation: effectiveDropoffLocation,
    pickupDate,
    returnDate,
    days: days,
    includeProtection,
    paymentMode,
    onlineMethod: paymentMode === 'offline' ? 'whatsapp' : onlineMethod,
    upiApp: onlineMethod === 'upi' ? upiApp : undefined,
    discountPercentage,
    discountAmount,
    discountCode: discountCode || (discountPercentage > 0 ? `${discountPercentage}% OFF` : undefined),
    priceBreakdown: {
      baseAmount: subtotal || total,
      discount: discountAmount,
      discountPercentage,
      protectionFee: insuranceCost,
      totalAmount: total,
    },
    totalAmount: total,
    paidAmount: amountDueNow,
    balanceAmount: amountDueAtPickup,
    securityDeposit: deposit,
  };
};

