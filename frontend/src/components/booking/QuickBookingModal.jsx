import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { BHUBANESWAR_LOCATIONS, SERVICE_OPTIONS } from '../../config/bookingConfig';
import { formatCurrency, getTodayDateString, ensureFutureDate } from '../../utils/formatters';
import { getQuickBookingWhatsAppMessage, openWhatsAppChat } from '../../utils/whatsapp';
import { paymentsAPI, invalidateClientCache } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { BookingStepServiceItem } from './BookingStepServiceItem';
import { BookingStepGuestReview } from './BookingStepGuestReview';
import { BookingStepConfirmation } from './BookingStepConfirmation';
import { useQuickBookingFleet } from './useQuickBookingFleet';
import { useDiscount } from '../../hooks/useDiscount';
import {
  normalizeServiceType,
  resolveBookingItemDetails,
  getActiveVehicleId,
  buildCheckoutPayload,
} from './quickBookingHelpers';

export const QuickBookingModal = ({
  isOpen,
  onClose,
  initialVehicle = null,
  initialData = {},
}) => {
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, openAuthModal } = useAuth();
  const { calculateDiscount, discount } = useDiscount();
  const [step, setStep] = useState(1);

  // Live Database Fleet via Hook
  const { dbCars, dbBikes, dbTours, dbDrivers } = useQuickBookingFleet(isOpen);

  // 1. Service Type selection
  const [selectedService, setSelectedService] = useState('self-drive-car');

  // 2. Selected contextual item
  const [selectedCar, setSelectedCar] = useState(null);
  const [selectedChauffeurCar, setSelectedChauffeurCar] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedBike, setSelectedBike] = useState(null);
  const [selectedTour, setSelectedTour] = useState(null);
  const [userCarModel, setUserCarModel] = useState('');

  // 3. Location fields (Bhubaneswar Hubs)
  const [pickupLocation, setPickupLocation] = useState('SUM Hospital');
  const [dropoffLocation, setDropoffLocation] = useState('Same as Pick-up Address');

  // 4. Dates & Optional Protection (Always default to future dates)
  const [pickupDate, setPickupDate] = useState(() => getTodayDateString(1));
  const [returnDate, setReturnDate] = useState(() => getTodayDateString(3));
  const [includeProtection, setIncludeProtection] = useState(false);

  const [guestName, setGuestName] = useState(() => currentUser?.name || '');
  const [guestEmail, setGuestEmail] = useState(() => currentUser?.email || '');
  const [guestPhone, setGuestPhone] = useState(() => currentUser?.phone || '');
  const [guestNotes, setGuestNotes] = useState('');
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [drivingLicenseDoc, setDrivingLicenseDoc] = useState(null);
  const [drivingLicenseDocName, setDrivingLicenseDocName] = useState('');
  const [idProofDoc, setIdProofDoc] = useState(null);
  const [idProofDocName, setIdProofDocName] = useState('');
  const [bookingCode, setBookingCode] = useState('');
  const [paymentNumber, setPaymentNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [step1Error, setStep1Error] = useState(null);

  // Auto-sync guest fields if user logs in
  useEffect(() => {
    if (currentUser) {
      if (!guestName && currentUser.name) setGuestName(currentUser.name);
      if (!guestEmail && currentUser.email) setGuestEmail(currentUser.email);
      if (!guestPhone && currentUser.phone) setGuestPhone(currentUser.phone);
    }
  }, [currentUser, isOpen]);

  // 5. Direct WhatsApp Booking by default (Online / Partial gateways temporarily paused)
  const [paymentMode, setPaymentMode] = useState('offline');
  const [onlineMethod, setOnlineMethod] = useState('upi');
  const [upiApp, setUpiApp] = useState('gpay');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [transactionId, setTransactionId] = useState('');

  // Auto-select initial item or fallback to DB fleet with guaranteed availability priority
  useEffect(() => {
    if (!isOpen) return;

    const firstAvailCar = dbCars.find((c) => c.isAvailable && (c.availableCount > 0 || c.quantity > 0)) || dbCars.find((c) => c.isAvailable) || dbCars[0];
    const firstAvailBike = dbBikes.find((b) => b.isAvailable && (b.availableCount > 0 || b.quantity > 0)) || dbBikes.find((b) => b.isAvailable) || dbBikes[0];
    const firstAvailTour = dbTours.find((t) => t.isAvailable) || dbTours[0];
    const firstAvailDriver = dbDrivers.find((d) => d.isAvailable !== false) || dbDrivers[0];

    if (firstAvailCar && (!selectedCar || !selectedCar.isAvailable)) setSelectedCar(firstAvailCar);
    if (firstAvailCar && (!selectedChauffeurCar || !selectedChauffeurCar.isAvailable)) setSelectedChauffeurCar(firstAvailCar);
    if (firstAvailBike && (!selectedBike || !selectedBike.isAvailable)) setSelectedBike(firstAvailBike);
    if (firstAvailTour && !selectedTour) setSelectedTour(firstAvailTour);
    if (firstAvailDriver && !selectedDriver) setSelectedDriver(firstAvailDriver);

    const targetItem = initialVehicle || initialData?.vehicle;
    const rawService = initialData?.serviceType || initialVehicle?.serviceType;
    const targetService = normalizeServiceType(rawService, targetItem);

    if (targetItem) {
      const matchItem = (item) => {
        if (!item) return false;
        const targetId = targetItem._id || targetItem.rawId || targetItem.id;
        const itemId = item._id || item.rawId || item.id;
        return (targetId && itemId && String(targetId) === String(itemId)) || (item.name && targetItem.name && item.name.toLowerCase() === targetItem.name.toLowerCase());
      };

      if (targetService === 'self-drive-bike') {
        const found = dbBikes.find(matchItem);
        setSelectedBike(found || targetItem);
      } else if (targetService === 'tour-packages') {
        const found = dbTours.find(matchItem);
        setSelectedTour(found || targetItem);
      } else if (targetService === 'driver-only') {
        const found = dbDrivers.find(matchItem);
        setSelectedDriver(found || targetItem);
      } else if (targetService === 'car-with-driver') {
        const found = dbCars.find(matchItem);
        setSelectedChauffeurCar(found || targetItem);
      } else {
        const found = dbCars.find(matchItem);
        setSelectedCar(found || targetItem);
      }
    }

    if (targetService) setSelectedService(targetService);
    if (initialData?.pickupDate) setPickupDate(ensureFutureDate(initialData.pickupDate, 1));
    if (initialData?.returnDate) {
      const sanitizedPickup = ensureFutureDate(initialData.pickupDate, 1);
      const sanitizedReturn = ensureFutureDate(initialData.returnDate, 3);
      setReturnDate(sanitizedReturn >= sanitizedPickup ? sanitizedReturn : sanitizedPickup);
    }
    if (initialData?.location || initialData?.pickupLocation) {
      const loc = (initialData.location || initialData.pickupLocation || '').trim();
      if (loc) setPickupLocation(loc);
    }
    if (initialData?.dropLocation || initialData?.dropoffLocation) {
      const dropLoc = (initialData.dropLocation || initialData.dropoffLocation || '').trim();
      if (
        dropLoc === 'Same as Pick-up Address' ||
        dropLoc === 'Same as Pickup' ||
        dropLoc === 'Same as Pick-up Location' ||
        dropLoc === pickupLocation
      ) {
        setDropoffLocation('Same as Pick-up Address');
      } else if (dropLoc) {
        setDropoffLocation(dropLoc);
      }
    }
  }, [initialVehicle, initialData, isOpen, dbCars, dbBikes, dbTours, dbDrivers]);

  // Days calculation
  const days = useMemo(() => {
    if (!pickupDate || !returnDate) return 1;
    const start = new Date(pickupDate).getTime();
    const end = new Date(returnDate).getTime();
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, isNaN(diffDays) ? 1 : diffDays);
  }, [pickupDate, returnDate]);

  const currentService = useMemo(() => {
    return SERVICE_OPTIONS.find((s) => s.id === selectedService) || SERVICE_OPTIONS[0];
  }, [selectedService]);

  const effectivePickupLocation = pickupLocation;
  const effectiveDropoffLocation = dropoffLocation === 'Same as Pick-up Address' ? pickupLocation : dropoffLocation;

  // Resolve item details cleanly using extracted helper
  const { currentItemName, currentItemImage, ratePerDay, deposit, isAvailable } = useMemo(() => {
    return resolveBookingItemDetails({
      selectedService,
      selectedCar,
      selectedChauffeurCar,
      selectedDriver,
      selectedBike,
      selectedTour,
      dbCars,
      dbDrivers,
      dbBikes,
      dbTours,
    });
  }, [selectedService, selectedCar, selectedChauffeurCar, selectedDriver, selectedBike, selectedTour, dbCars, dbDrivers, dbBikes, dbTours]);

  const subtotal = ratePerDay * days;
  const discountCalculation = useMemo(() => {
    return calculateDiscount(subtotal, selectedService);
  }, [calculateDiscount, subtotal, selectedService]);

  const discountAmount = discountCalculation.discountAmount || 0;
  const discountPercent = discountCalculation.discountPercent || 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  const insurancePerDay = selectedService === 'driver-only' || selectedService === 'tour-packages' ? 0 : 499;
  const insuranceCost = includeProtection ? insurancePerDay * days : 0;
  const total = discountedSubtotal + insuranceCost;

  const partialPercentage = 0.25;
  const partialAmount = Math.max(499, Math.round(total * partialPercentage));
  const remainingAmount = Math.max(0, total - partialAmount);

  const amountDueNow = paymentMode === 'full' ? total : paymentMode === 'partial' ? partialAmount : 0;
  const amountDueAtPickup = paymentMode === 'full' ? 0 : paymentMode === 'partial' ? remainingAmount : total;

  const handleProceedToDetails = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setStep1Error(null);

    if (!isAvailable) {
      setStep1Error('The selected vehicle is currently unavailable. Please pick an available vehicle.');
      return;
    }

    const today = getTodayDateString(0);
    if (!pickupDate || pickupDate < today) {
      setStep1Error('Back-dated bookings are not allowed. Please select today or a future date for pick-up.');
      setPickupDate(today);
      return;
    }
    if (returnDate && returnDate < pickupDate) {
      setStep1Error('Return date cannot be earlier than pick-up date.');
      setReturnDate(pickupDate);
      return;
    }

    if (!guestName || !guestName.trim()) {
      setStep1Error('Please enter your full name as on your ID or driving license.');
      return;
    }
    const cleanPhone = guestPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setStep1Error('Please enter a valid 10-digit WhatsApp/phone number.');
      return;
    }
    if (!guestEmail || !guestEmail.trim() || !guestEmail.includes('@')) {
      setStep1Error('Please enter a valid email address to receive your booking confirmation.');
      return;
    }

    if (selectedService === 'self-drive-car' || selectedService === 'self-drive-bike') {
      if (!drivingLicenseNumber || !drivingLicenseNumber.trim()) {
        setStep1Error('Please enter your valid Government Driving License Number for self-drive booking.');
        return;
      }
      if (!drivingLicenseDoc) {
        setStep1Error('Please upload your Driving License photo or PDF document.');
        return;
      }
    }

    setStep(2);
  };

  const handlePaymentSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setPaymentError(null);

    if (!guestName.trim()) {
      setPaymentError('Please enter your full name as on your ID or driving license.');
      return;
    }
    if (!guestPhone.trim() || guestPhone.replace(/[^0-9]/g, '').length < 10) {
      setPaymentError('Please enter a valid 10-digit WhatsApp/phone number.');
      return;
    }
    if (paymentMode !== 'offline' && (!guestEmail.trim() || !guestEmail.includes('@'))) {
      setPaymentError('Please enter a valid email address to receive your payment confirmation.');
      return;
    }

    if (selectedService === 'self-drive-car' || selectedService === 'self-drive-bike') {
      if (!drivingLicenseNumber || !drivingLicenseNumber.trim()) {
        setPaymentError('Please enter your valid Government Driving License Number.');
        setStep(1);
        return;
      }
      if (!drivingLicenseDoc) {
        setPaymentError('Please upload your Driving License document.');
        setStep(1);
        return;
      }
    }

    const today = getTodayDateString(0);
    if (!pickupDate || pickupDate < today) {
      setPaymentError('Pick-up date cannot be in the past. Please choose today or a future date.');
      setStep(1);
      return;
    }

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const activeVehicleId = getActiveVehicleId({
        selectedService,
        selectedCar,
        selectedChauffeurCar,
        selectedBike,
        selectedTour,
        selectedDriver,
        initialVehicle,
      });

      const checkoutPayload = buildCheckoutPayload({
        selectedService,
        guestName,
        guestPhone,
        guestEmail,
        guestNotes,
        drivingLicenseNumber,
        drivingLicenseDoc,
        drivingLicenseDocName,
        idProofDoc,
        idProofDocName,
        discountPercentage: discountPercent,
        discountAmount,
        discountCode: discountCalculation?.badgeText || (discountPercent > 0 ? `${discountPercent}% OFF` : undefined),
        subtotal,
        insuranceCost,
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
      });

      const res = await paymentsAPI.processCheckout(checkoutPayload);
      const resData = res?.data || res || {};
      const bookingData = resData.booking || resData;
      const paymentData = resData.payment || {};

      const finalBookingNumber = resData.bookingNumber || bookingData.bookingNumber || ('CZ-' + Math.floor(1000 + Math.random() * 9000));
      const finalPaymentNumber = resData.paymentNumber || paymentData.paymentNumber || ('PAY-' + Math.floor(1000 + Math.random() * 9000));
      const finalTxnId = resData.transactionId || paymentData.transactionId || (paymentMode === 'offline' ? 'PAY_ON_PICKUP' : 'TXN-' + Math.floor(100000 + Math.random() * 900000));
      const finalInvoiceNumber = resData.invoiceNumber || bookingData.invoiceNumber || `INV-${finalBookingNumber.replace(/^CZ-/, '')}`;

      setBookingCode(finalBookingNumber);
      setPaymentNumber(finalPaymentNumber);
      setTransactionId(finalTxnId);
      setInvoiceNumber(finalInvoiceNumber);
      setConfirmedBooking(bookingData);

      invalidateClientCache();

      if (paymentMode === 'offline') {
        const waMsg = getQuickBookingWhatsAppMessage({
          serviceName: currentService?.label,
          vehicleName: userCarModel ? `${currentItemName} (Client Car: ${userCarModel})` : currentItemName,
          userCarModel,
          pickupDate,
          returnDate,
          days: days,
          location: effectivePickupLocation,
          dropLocation: effectiveDropoffLocation,
          protection: includeProtection ? 'Zero-Excess Damage Waiver' : 'Standard / None',
          deposit,
          discount: discountAmount > 0 ? `${discountPercent}% OFF (-${formatCurrency(discountAmount)})` : undefined,
          total: formatCurrency(total),
          paymentMode: 'Offline Payment (Pay on Pickup via Cash / UPI)',
          paidNow: '₹0 (Zero Advance Online)',
          balanceOnPickup: formatCurrency(total),
          bookingCode: finalBookingNumber,
          guestName,
          guestPhone,
          guestEmail,
          drivingLicenseNumber,
          notes: guestNotes,
        });
        openWhatsAppChat(waMsg);
      }

      setStep(3);
    } catch (err) {
      console.error('Checkout processing error:', err);
      setPaymentError(err.message || 'Payment processing failed. Please try again or choose Offline Payment.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const resetAndClose = () => {
    setStep(1);
    setIsProcessingPayment(false);
    setPaymentError(null);
    setStep1Error(null);
    setConfirmedBooking(null);
    setInvoiceNumber('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={resetAndClose}
      title={step === 3 ? 'Reservation Confirmed' : 'Instant Booking & Reservation'}
      subtitle={
        step === 1 ? 'Step 1 of 2: Booking Details & Contact Information' :
          step === 2 ? 'Step 2 of 2: Confirm WhatsApp Booking' :
            'Your white-glove booking reservation is locked and verified.'
      }
      maxWidth="max-w-2xl"
    >
      {/* Step Indicator Header (Clean 2-Step Flow) */}
      {step < 3 && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              1
            </span>
            <span className={step >= 1 ? 'text-slate-900 font-bold' : 'text-slate-500'}>
              Booking & User Details
            </span>
          </div>
          <div className="h-[1px] flex-1 mx-4 bg-slate-200" />
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${step >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              2
            </span>
            <span className={step >= 2 ? 'text-slate-900 font-bold' : 'text-slate-500'}>
              Confirm on WhatsApp
            </span>
          </div>
        </div>
      )}

      {/* STEP 1: Service, Fleet, Dates, Locations AND Customer Details */}
      {step === 1 && (
        <BookingStepServiceItem
          selectedService={selectedService}
          setSelectedService={setSelectedService}
          currentService={currentService}
          currentItemName={currentItemName}
          currentItemImage={currentItemImage}
          ratePerDay={ratePerDay}
          deposit={deposit}
          isAvailable={isAvailable}
          dbCars={dbCars}
          dbBikes={dbBikes}
          dbTours={dbTours}
          dbDrivers={dbDrivers}
          selectedCar={selectedCar}
          setSelectedCar={setSelectedCar}
          selectedChauffeurCar={selectedChauffeurCar}
          setSelectedChauffeurCar={setSelectedChauffeurCar}
          selectedBike={selectedBike}
          setSelectedBike={setSelectedBike}
          selectedTour={selectedTour}
          setSelectedTour={setSelectedTour}
          selectedDriver={selectedDriver}
          setSelectedDriver={setSelectedDriver}
          pickupLocation={pickupLocation}
          setPickupLocation={setPickupLocation}
          dropoffLocation={dropoffLocation}
          setDropoffLocation={setDropoffLocation}
          pickupDate={pickupDate}
          setPickupDate={setPickupDate}
          returnDate={returnDate}
          setReturnDate={setReturnDate}
          includeProtection={includeProtection}
          setIncludeProtection={setIncludeProtection}
          insurancePerDay={insurancePerDay}
          insuranceCost={insuranceCost}
          days={days}
          subtotal={subtotal}
          discountAmount={discountAmount}
          discountPercent={discountPercent}
          discountResult={discountCalculation}
          total={total}
          userCarModel={userCarModel}
          effectivePickupLocation={effectivePickupLocation}
          effectiveDropoffLocation={effectiveDropoffLocation}
          guestName={guestName}
          setGuestName={setGuestName}
          guestEmail={guestEmail}
          setGuestEmail={setGuestEmail}
          guestPhone={guestPhone}
          setGuestPhone={setGuestPhone}
          guestNotes={guestNotes}
          setGuestNotes={setGuestNotes}
          drivingLicenseNumber={drivingLicenseNumber}
          setDrivingLicenseNumber={setDrivingLicenseNumber}
          drivingLicenseDoc={drivingLicenseDoc}
          setDrivingLicenseDoc={setDrivingLicenseDoc}
          drivingLicenseDocName={drivingLicenseDocName}
          setDrivingLicenseDocName={setDrivingLicenseDocName}
          idProofDoc={idProofDoc}
          setIdProofDoc={setIdProofDoc}
          idProofDocName={idProofDocName}
          setIdProofDocName={setIdProofDocName}
          step1Error={step1Error}
          onProceed={handleProceedToDetails}
        />
      )}

      {/* STEP 2: Dedicated Payment & Checkout Page */}
      {step === 2 && (
        <BookingStepGuestReview
          currentItemName={currentItemName}
          effectivePickupLocation={effectivePickupLocation}
          effectiveDropoffLocation={effectiveDropoffLocation}
          pickupDate={pickupDate}
          returnDate={returnDate}
          days={days}
          includeProtection={includeProtection}
          guestName={guestName}
          setGuestName={setGuestName}
          guestEmail={guestEmail}
          setGuestEmail={setGuestEmail}
          guestPhone={guestPhone}
          setGuestPhone={setGuestPhone}
          guestNotes={guestNotes}
          setGuestNotes={setGuestNotes}
          drivingLicenseNumber={drivingLicenseNumber}
          drivingLicenseDoc={drivingLicenseDoc}
          drivingLicenseDocName={drivingLicenseDocName}
          idProofDoc={idProofDoc}
          idProofDocName={idProofDocName}
          subtotal={subtotal}
          discountAmount={discountAmount}
          discountPercent={discountPercent}
          paymentMode={paymentMode}
          setPaymentMode={setPaymentMode}
          paymentError={paymentError}
          total={total}
          partialAmount={partialAmount}
          remainingAmount={remainingAmount}
          amountDueNow={amountDueNow}
          amountDueAtPickup={amountDueAtPickup}
          onlineMethod={onlineMethod}
          setOnlineMethod={setOnlineMethod}
          upiApp={upiApp}
          setUpiApp={setUpiApp}
          isProcessingPayment={isProcessingPayment}
          isAuthenticated={isAuthenticated}
          openAuthModal={openAuthModal}
          onBack={() => setStep(1)}
          onSubmit={handlePaymentSubmit}
        />
      )}

      {/* STEP 3: Reservation Confirmation Receipt */}
      {step === 3 && (
        <BookingStepConfirmation
          paymentMode={paymentMode}
          bookingCode={bookingCode}
          paymentNumber={paymentNumber}
          invoiceNumber={invoiceNumber}
          confirmedBooking={confirmedBooking}
          transactionId={transactionId}
          guestName={guestName}
          guestPhone={guestPhone}
          guestEmail={guestEmail}
          guestNotes={guestNotes}
          currentService={currentService}
          currentItemName={currentItemName}
          userCarModel={userCarModel}
          pickupDate={pickupDate}
          returnDate={returnDate}
          selectedService={selectedService}
          days={days}
          effectivePickupLocation={effectivePickupLocation}
          effectiveDropoffLocation={effectiveDropoffLocation}
          includeProtection={includeProtection}
          amountDueNow={amountDueNow}
          amountDueAtPickup={amountDueAtPickup}
          remainingAmount={remainingAmount}
          total={total}
          deposit={deposit}
          onResetAndClose={resetAndClose}
          onViewBooking={() => {
            resetAndClose();
            navigate(`/my-bookings?code=${encodeURIComponent(bookingCode)}`, {
              state: {
                bookingCode,
                phone: guestPhone,
                email: guestEmail,
              },
            });
          }}
        />
      )}
    </Modal>
  );
};
