import React, { useEffect } from 'react';
import { MapPin, Calendar, Clock } from 'lucide-react';
import { BHUBANESWAR_LOCATIONS } from '../../config/bookingConfig';
import { getTodayDateString, getCurrentTimeString } from '../../utils/formatters';
import { SearchableLocationInput } from '../common/SearchableLocationInput';

export const HeroDateTimeSelector = ({
  activeTab,
  pickupLocation = '',
  dropLocation,
  setDropLocation,
  pickupDate,
  setPickupDate,
  pickupTime,
  setPickupTime,
  returnDate,
  setReturnDate,
  returnTime,
  setReturnTime,
}) => {
  const today = getTodayDateString(0);
  const nowTime = getCurrentTimeString(0);

  // Frontend safety guard: continuously adjust if selected date/time becomes past
  useEffect(() => {
    const curToday = getTodayDateString(0);
    const curNow = getCurrentTimeString(0);

    if (pickupDate && pickupDate < curToday) {
      setPickupDate(curToday);
    }
    if (pickupDate === curToday && pickupTime && pickupTime < curNow) {
      setPickupTime(getCurrentTimeString(30));
    }
    if (returnDate && pickupDate && returnDate < pickupDate) {
      setReturnDate(pickupDate);
    }
    if (returnDate === pickupDate && returnTime && pickupTime && returnTime <= pickupTime) {
      const [h, m] = pickupTime.split(':').map(Number);
      const nextH = Math.min(23, (h || 10) + 2);
      setReturnTime(`${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`);
    }
  }, [pickupDate, pickupTime, returnDate, returnTime, setPickupDate, setPickupTime, setReturnDate, setReturnTime]);

  const handlePickupDateChange = (val) => {
    if (!val || val < today) {
      setPickupDate(today);
      if (pickupTime < nowTime) setPickupTime(getCurrentTimeString(30));
      if (returnDate && returnDate < today) setReturnDate(today);
    } else {
      setPickupDate(val);
      if (val === today && pickupTime < nowTime) {
        setPickupTime(getCurrentTimeString(30));
      }
      if (returnDate && returnDate < val) setReturnDate(val);
    }
  };

  const handlePickupTimeChange = (val) => {
    if (pickupDate === today && val < nowTime) {
      // Auto adjust to current time + 15 mins if past time chosen
      setPickupTime(getCurrentTimeString(15));
    } else {
      setPickupTime(val);
      if (returnDate === pickupDate && returnTime <= val) {
        const [h, m] = val.split(':').map(Number);
        const nextH = Math.min(23, (h || 10) + 2);
        setReturnTime(`${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`);
      }
    }
  };

  const handleReturnDateChange = (val) => {
    const minAllowed = pickupDate || today;
    if (!val || val < minAllowed) {
      setReturnDate(minAllowed);
    } else {
      setReturnDate(val);
    }
    if (val === pickupDate && returnTime <= pickupTime) {
      const [h, m] = (pickupTime || '10:00').split(':').map(Number);
      const nextH = Math.min(23, (h || 10) + 2);
      setReturnTime(`${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`);
    }
  };

  const handleReturnTimeChange = (val) => {
    if (returnDate === pickupDate && pickupTime && val < pickupTime) {
      setReturnTime(pickupTime);
    } else {
      setReturnTime(val);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 sm:gap-3 items-start">
      {/* Drop-off Location (Supports Manual Typing + Landmark Select for Car With Driver) */}
      <div className="lg:col-span-4 space-y-1 p-2 sm:p-2.5 rounded-xl bg-slate-50/90 hover:bg-white focus-within:bg-white border border-slate-200/90 hover:border-blue-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15 transition-all shadow-xs">
        {activeTab === 'car-with-driver' || activeTab === 'driver-only' ? (
          <SearchableLocationInput
            id="hero-dropoff-location"
            label="3. Drop-off Destination / Address"
            value={dropLocation}
            onChange={setDropLocation}
            options={BHUBANESWAR_LOCATIONS}
            placeholder="Type destination, hotel, or choose landmark..."
            allowCustom={true}
            includeSameAsPickup={true}
            pickupLocationValue={pickupLocation}
          />
        ) : (
          <>
            <label className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>3. Drop-off Location</span>
            </label>
            <select
              value={dropLocation}
              onChange={(e) => setDropLocation(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-900 focus:outline-none cursor-pointer py-1 sm:py-0.5 min-h-[38px] sm:min-h-0"
            >
              <option value="Same as Pick-up Location" className="bg-white text-slate-900 font-medium">🔄 Same as Pick-up Location</option>
              {BHUBANESWAR_LOCATIONS.map((loc) => (
                <option key={loc} value={loc} className="bg-white text-slate-900 font-medium">
                  📍 {loc}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Pick-up Date & Time */}
      <div className="lg:col-span-4 space-y-1 p-2 sm:p-2.5 rounded-xl bg-slate-50/90 hover:bg-white focus-within:bg-white border border-slate-200/90 hover:border-blue-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15 transition-all shadow-xs">
        <div className="flex items-center justify-between">
          <label className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>4. Pick-up Date & Time</span>
          </label>
          <span className="text-[8px] text-blue-700 font-bold bg-blue-50 border border-blue-200 px-1 py-0.2 rounded">
            Live
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <input
            type="date"
            min={today}
            value={pickupDate}
            onChange={(e) => handlePickupDateChange(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-bold text-slate-900 focus:outline-none cursor-pointer [color-scheme:light] py-1 sm:py-0.5 min-h-[38px] sm:min-h-0"
          />
          <input
            type="time"
            min={pickupDate === today ? nowTime : undefined}
            value={pickupTime}
            onChange={(e) => handlePickupTimeChange(e.target.value)}
            title={pickupDate === today ? `Cannot select past time (Current: ${nowTime})` : 'Select pick-up time'}
            className="w-[84px] xs:w-24 sm:w-20 shrink-0 bg-slate-100 hover:bg-white px-1.5 sm:px-1 py-1 sm:py-0.5 rounded text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer [color-scheme:light] border border-slate-200/90 focus:border-blue-600 min-h-[38px] sm:min-h-0"
          />
        </div>
      </div>

      {/* Return Date & Time */}
      <div className="lg:col-span-4 space-y-1 p-2 sm:p-2.5 rounded-xl bg-slate-50/90 hover:bg-white focus-within:bg-white border border-slate-200/90 hover:border-blue-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15 transition-all shadow-xs">
        <label className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>5. Return Date & Time</span>
        </label>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <input
            type="date"
            min={pickupDate || today}
            value={returnDate}
            onChange={(e) => handleReturnDateChange(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm font-bold text-slate-900 focus:outline-none cursor-pointer [color-scheme:light] py-1 sm:py-0.5 min-h-[38px] sm:min-h-0"
          />
          <input
            type="time"
            min={returnDate === pickupDate ? pickupTime : undefined}
            value={returnTime}
            onChange={(e) => handleReturnTimeChange(e.target.value)}
            className="w-[84px] xs:w-24 sm:w-20 shrink-0 bg-slate-100 hover:bg-white px-1.5 sm:px-1 py-1 sm:py-0.5 rounded text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer [color-scheme:light] border border-slate-200/90 focus:border-blue-600 min-h-[38px] sm:min-h-0"
          />
        </div>
      </div>
    </div>
  );
};

