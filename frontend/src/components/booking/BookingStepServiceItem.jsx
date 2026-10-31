import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '../common/Button';
import { formatCurrency } from '../../utils/formatters';
import { BookingFleetItemSelector } from './BookingFleetItemSelector';
import { BookingLocationDatesSection } from './BookingLocationDatesSection';
import { BookingCustomerForm } from './BookingCustomerForm';

export const BookingStepServiceItem = ({
  selectedService,
  setSelectedService,
  currentService,
  currentItemName,
  currentItemImage,
  ratePerDay,
  deposit,
  isAvailable,
  dbCars,
  dbBikes,
  dbTours,
  dbDrivers,
  selectedCar,
  setSelectedCar,
  selectedChauffeurCar,
  setSelectedChauffeurCar,
  selectedBike,
  setSelectedBike,
  selectedTour,
  setSelectedTour,
  selectedDriver,
  setSelectedDriver,
  pickupLocation,
  setPickupLocation,
  dropoffLocation,
  setDropoffLocation,
  pickupDate,
  setPickupDate,
  returnDate,
  setReturnDate,
  includeProtection,
  setIncludeProtection,
  insurancePerDay,
  insuranceCost,
  days,
  subtotal = 0,
  discountAmount = 0,
  discountPercent = 0,
  discountResult = null,
  total,
  userCarModel,
  effectivePickupLocation,
  effectiveDropoffLocation,
  guestName,
  setGuestName,
  guestEmail,
  setGuestEmail,
  guestPhone,
  setGuestPhone,
  guestNotes,
  setGuestNotes,
  drivingLicenseNumber,
  setDrivingLicenseNumber,
  drivingLicenseDoc,
  setDrivingLicenseDoc,
  drivingLicenseDocName,
  setDrivingLicenseDocName,
  idProofDoc,
  setIdProofDoc,
  idProofDocName,
  setIdProofDocName,
  step1Error,
  onProceed,
}) => {
  return (
    <form onSubmit={onProceed} className="space-y-4">
      {/* 1. Selected Service Category Info (Read-Only) */}
      <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-between text-xs shadow-xs">
        <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">
          Service Category
        </span>
        <span className="font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
          {currentService?.label || (selectedService === 'self-drive-bike' ? 'Self-Drive Bike' : 'Self-Drive Car')}
        </span>
      </div>

      {/* 2. DYNAMIC FLEET ITEM SELECTOR (MODULAR) */}
      <BookingFleetItemSelector
        selectedService={selectedService}
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
      />

      {/* 3. HUBS & DATES SELECTION (MODULAR) */}
      <BookingLocationDatesSection
        selectedService={selectedService}
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
      />

      {/* 4. CUSTOMER DETAILS & DRIVING LICENSE VERIFICATION (MODULAR) */}
      <BookingCustomerForm
        guestName={guestName}
        setGuestName={setGuestName}
        guestEmail={guestEmail}
        setGuestEmail={setGuestEmail}
        guestPhone={guestPhone}
        setGuestPhone={setGuestPhone}
        guestNotes={guestNotes}
        setGuestNotes={setGuestNotes}
        selectedService={selectedService}
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
      />

      {/* 5. TOTAL BREAKDOWN PREVIEW */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-600 font-medium">
            Rental Rate ({days} {days === 1 ? 'Day' : 'Days'} × {formatCurrency(ratePerDay)}/day):
          </span>
          <span className="font-bold text-slate-900">{formatCurrency(subtotal || (ratePerDay * days))}</span>
        </div>

        {discountAmount > 0 && (
          <div className="flex items-center justify-between text-emerald-700 bg-emerald-50/80 p-2 rounded-lg border border-emerald-200/80 font-bold">
            <span className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black uppercase">
                {discountPercent}% OFF
              </span>
              <span>Admin Promotional Discount:</span>
            </span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
        )}

        {insuranceCost > 0 && (
          <div className="flex items-center justify-between text-slate-600">
            <span>🛡️ Zero-Excess Protection:</span>
            <span className="font-semibold text-slate-800">+{formatCurrency(insuranceCost)}</span>
          </div>
        )}

        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
          <div className="text-slate-700 font-bold text-xs">
            Net Booking Total:
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-2 justify-end">
              {discountAmount > 0 && (
                <span className="text-xs text-slate-400 line-through font-semibold">
                  {formatCurrency((subtotal || (ratePerDay * days)) + insuranceCost)}
                </span>
              )}
              <span className="text-lg font-black text-slate-950">{formatCurrency(total)}</span>
            </div>
            <span className="text-slate-500 block text-[10px]">
              Refundable Security Deposit: {deposit}
            </span>
          </div>
        </div>
      </div>

      {/* 6. ACTION BUTTONS */}
      <div className="space-y-2.5 pt-1">
        {isAvailable ? (
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full"
            icon={ArrowRight}
            iconPosition="right"
          >
            Proceed to Confirm Booking →
          </Button>
        ) : (
          <div className="space-y-1.5">
            <button
              type="button"
              disabled
              className="w-full py-3.5 px-4 rounded-xl font-black text-xs text-rose-500 bg-rose-50 border border-rose-200 cursor-not-allowed select-none text-center shadow-xs"
            >
              Currently Unavailable
            </button>
            <p className="text-[11px] text-rose-600 text-center font-medium">
              The selected vehicle has 0 units available in our fleet and is currently unavailable.
              Please select another available model.
            </p>
          </div>
        )}
      </div>
    </form>
  );
};
