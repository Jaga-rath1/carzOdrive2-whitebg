import React, { useEffect } from 'react';
import { MapPin, Calendar } from 'lucide-react';
import { BHUBANESWAR_LOCATIONS } from '../../config/bookingConfig';
import { formatCurrency, getTodayDateString } from '../../utils/formatters';
import { SearchableLocationInput } from '../common/SearchableLocationInput';

export const BookingLocationDatesSection = ({
  selectedService = 'self-drive-car',
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
}) => {
  useEffect(() => {
    const today = getTodayDateString(0);
    if (pickupDate && pickupDate < today) {
      setPickupDate(today);
    }
    if (returnDate && pickupDate && returnDate < pickupDate) {
      setReturnDate(pickupDate);
    }
  }, [pickupDate, returnDate, setPickupDate, setReturnDate]);

  const isDriverService = selectedService === 'car-with-driver' || selectedService === 'driver-only';

  return (
    <div className="space-y-3">
      {/* 1. Hub Location Inputs (Allows Manual Typing + Suggestions for Car with Driver) */}
      <div className="space-y-3">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all space-y-1.5">
          {isDriverService ? (
            <SearchableLocationInput
              id="modal-pickup-location"
              label="Pick-up / Delivery Address"
              value={pickupLocation}
              onChange={setPickupLocation}
              options={BHUBANESWAR_LOCATIONS}
              placeholder="Type doorstep address or choose landmark..."
              allowCustom={true}
            />
          ) : (
            <>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Pick-up / Delivery Location
              </label>
              <select
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                className="w-full bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
              >
                {BHUBANESWAR_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    📍 {loc}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all space-y-1.5">
          {isDriverService ? (
            <SearchableLocationInput
              id="modal-dropoff-location"
              label="Drop-off / Destination Address"
              value={dropoffLocation}
              onChange={setDropoffLocation}
              options={BHUBANESWAR_LOCATIONS}
              placeholder="Type destination, hotel, or choose landmark..."
              allowCustom={true}
              includeSameAsPickup={true}
              pickupLocationValue={pickupLocation}
            />
          ) : (
            <>
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Drop-off / Return Location
              </label>
              <select
                value={dropoffLocation}
                onChange={(e) => setDropoffLocation(e.target.value)}
                className="w-full bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
              >
                <option value="Same as Pick-up Address">🔄 Same as Pick-up Address</option>
                {BHUBANESWAR_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    📍 {loc}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* 2. Dates Selection */}
      <div className="space-y-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Pick-up Date
            </label>
            <input
              type="date"
              required
              min={getTodayDateString(0)}
              value={pickupDate}
              onChange={(e) => {
                const val = e.target.value;
                const today = getTodayDateString(0);
                if (val && val < today) {
                  setPickupDate(today);
                  if (returnDate && returnDate < today) setReturnDate(today);
                } else {
                  setPickupDate(val);
                  if (returnDate && returnDate < val) setReturnDate(val);
                }
              }}
              className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Return Date
            </label>
            <input
              type="date"
              required
              min={pickupDate || getTodayDateString(0)}
              value={returnDate}
              onChange={(e) => {
                const val = e.target.value;
                const minAllowed = pickupDate || getTodayDateString(0);
                if (val && val < minAllowed) {
                  setReturnDate(minAllowed);
                } else {
                  setReturnDate(val);
                }
              }}
              className="w-full bg-transparent text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer"
            />
          </div>
        </div>
        <p className="text-[10.5px] text-slate-500 px-1">
          * Pick-up must be today or a future date. Back-dated reservations are disabled.
        </p>
      </div>

      {/* 3. Optional Protection Plan Add-On */}
      {insurancePerDay > 0 && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
            <span>Select Protection Level (Optional)</span>
            <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              Optional Add-On
            </span>
          </label>

          <div
            onClick={() => setIncludeProtection(!includeProtection)}
            role="button"
            tabIndex={0}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
              includeProtection
                ? 'bg-blue-50/80 border-blue-500 shadow-sm'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={includeProtection}
              onChange={() => {}}
              className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">Zero-Excess Damage Waiver</span>
                <span className="text-xs font-bold text-blue-600 shrink-0">
                  +{formatCurrency(insurancePerDay)}/day
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-relaxed">
                100% collision waiver + zero deductible on vehicle handover.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
