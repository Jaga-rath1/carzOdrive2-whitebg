import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';
import { BHUBANESWAR_LOCATIONS } from '../../config/bookingConfig';
import { HeroFleetSelector } from './HeroFleetSelector';
import { HeroDateTimeSelector } from './HeroDateTimeSelector';
import { SearchableLocationInput } from '../common/SearchableLocationInput';
import { useAuth } from '../../hooks/useAuth';

export const HeroSearchConsole = ({
  activeTab,
  activeService,
  activeMeta,
  dbCars,
  dbBikes,
  dbTours,
  selectedCarId,
  setSelectedCarId,
  selectedChauffeurId,
  setSelectedChauffeurId,
  driverDailyRate = 799,
  selectedBikeId,
  setSelectedBikeId,
  selectedTourId,
  setSelectedTourId,
  pickupLocation,
  setPickupLocation,
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
  currentSelectedItem,
  handleSearch,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, openAuthModal } = useAuth();

  const tripDays = useMemo(() => {
    if (!pickupDate || !returnDate) return 1;
    const start = new Date(pickupDate).getTime();
    const end = new Date(returnDate).getTime();
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return Math.max(1, isNaN(diff) ? 1 : diff);
  }, [pickupDate, returnDate]);

  const handleBookOnWhatsApp = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    const effectiveDrop =
      dropLocation === 'Same as Pick-up Location' || !dropLocation
        ? pickupLocation
        : dropLocation;
    const bookingPayload = {
      activeTab,
      activeService,
      currentSelectedItem,
      pickupLocation,
      dropLocation: effectiveDrop,
      pickupDate,
      pickupTime,
      returnDate,
      returnTime,
      tripDays,
    };
    try {
      sessionStorage.setItem('carzodrive_whatsapp_booking_intent', JSON.stringify(bookingPayload));
    } catch {
      // ignore
    }
    navigate('/book-on-whatsapp', { state: bookingPayload });
  };


  const handleOnlineBookingSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    handleSearch(e);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="w-full bg-white/95 backdrop-blur-3xl border border-slate-200/90 rounded-2xl sm:rounded-3xl p-2.5 xs:p-3 sm:p-5 shadow-[0_25px_60px_rgba(15,23,42,0.08),0_4px_16px_rgba(15,23,42,0.04)] text-left relative overflow-hidden"
    >
      {/* Ambient Royal Blue Top Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-600 to-transparent shadow-[0_0_10px_rgba(37,99,235,0.4)]" />

      {/* Console Header with View Details Action (Auth Guarded) */}
      <div className="flex items-center justify-between pb-2 sm:pb-2.5 border-b border-slate-200/80 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 sm:h-2.5 sm:w-2.5 bg-emerald-500" />
          </span>
          <span className="text-[11px] sm:text-[13px] font-black text-slate-900 tracking-wide uppercase truncate">
            Live Fleet — <span className="text-blue-600 font-extrabold">{activeService.label}</span>
          </span>
          <span className="hidden md:inline text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0 shadow-xs">
            Instant Availability
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={activeMeta.route}
            className="inline-flex items-center gap-1.5 text-[10.5px] sm:text-xs font-bold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200/80 px-2.5 py-1 rounded-xl transition-all shadow-xs cursor-pointer"
            title={`Explore all ${activeService.label} models`}
          >
            <span>Explore Page →</span>
          </Link>
        </div>
      </div>

      {/* SEARCH FORM */}
      <form onSubmit={handleOnlineBookingSubmit} className="space-y-2 sm:space-y-3 pt-2">
        {/* ROW 1: Contextual Model Selector + Pick-up Hub */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          <HeroFleetSelector
            activeTab={activeTab}
            dbCars={dbCars}
            dbBikes={dbBikes}
            dbTours={dbTours}
            selectedCarId={selectedCarId}
            setSelectedCarId={setSelectedCarId}
            selectedChauffeurId={selectedChauffeurId}
            setSelectedChauffeurId={setSelectedChauffeurId}
            driverDailyRate={driverDailyRate}
            selectedBikeId={selectedBikeId}
            setSelectedBikeId={setSelectedBikeId}
            selectedTourId={selectedTourId}
            setSelectedTourId={setSelectedTourId}
          />

          {/* Pick-up Hub in Bhubaneswar (Manual Typing + Landmark Dropdown for Car with Driver) */}
          <div className="space-y-1 p-2 sm:p-2.5 rounded-xl bg-slate-50/90 hover:bg-white focus-within:bg-white border border-slate-200/90 hover:border-blue-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15 transition-all shadow-xs">
            {activeTab === 'car-with-driver' || activeTab === 'driver-only' ? (
              <SearchableLocationInput
                id="hero-pickup-address"
                label="2. Pick-up Address / Landmark"
                value={pickupLocation}
                onChange={setPickupLocation}
                options={BHUBANESWAR_LOCATIONS}
                placeholder="Type doorstep address, hotel, or choose landmark..."
                allowCustom={true}
              />
            ) : (
              <>
                <label className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>2. Pick-up Hub in Bhubaneswar</span>
                </label>
                <select
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-900 focus:outline-none cursor-pointer py-1 sm:py-0.5 min-h-[38px] sm:min-h-0"
                >
                  {BHUBANESWAR_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc} className="bg-white text-slate-900 font-medium">
                      📍 {loc}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* ROW 2: Drop-off Hub + Pickup Date/Time + Return Date/Time */}
        <HeroDateTimeSelector
          activeTab={activeTab}
          pickupLocation={pickupLocation}
          dropLocation={dropLocation}
          setDropLocation={setDropLocation}
          pickupDate={pickupDate}
          setPickupDate={setPickupDate}
          pickupTime={pickupTime}
          setPickupTime={setPickupTime}
          returnDate={returnDate}
          setReturnDate={setReturnDate}
          returnTime={returnTime}
          setReturnTime={setReturnTime}
        />

        {/* Bike pre-order notice */}
        {activeTab === 'self-drive-bike' && (
          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-[11px] sm:text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span>Two-Wheeler Fleet Coming Soon — Pre-bookings live via WhatsApp.</span>
            </div>
            <Link
              to="/bike-rental"
              className="font-black text-blue-600 hover:text-blue-800 underline shrink-0 text-xs"
            >
              View Bike Fleet & Pre-Book →
            </Link>
          </div>
        )}

        {/* BOTTOM ACTIONS: BOOK ON WHATSAPP & BOOK ONLINE */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-2.5 border-t border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left justify-center sm:justify-start">
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 font-semibold justify-center sm:justify-start">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Free cancellation up to 6 hours before pickup</span>
            </div>

            {currentSelectedItem?.originalPrice && currentSelectedItem.originalPrice > (currentSelectedItem.priceNumeric || currentSelectedItem.pricePerDay) && (
              <div className="inline-flex items-center gap-1.5 justify-center sm:justify-start bg-emerald-50/70 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg text-xs">
                <span className="font-extrabold text-slate-900 truncate max-w-[130px] sm:max-w-none">
                  {currentSelectedItem.name}
                </span>
                <span className="text-slate-400 font-bold">•</span>
                <span className="text-[11px] text-red-500 font-bold line-through decoration-red-600 decoration-[2.5px]">
                  ₹{currentSelectedItem.originalPrice.toLocaleString('en-IN')}
                </span>
                <span className="text-slate-400 font-black">•</span>
                <span className="text-xs sm:text-sm font-black text-emerald-700">
                  {currentSelectedItem.priceDisplay}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">

            {/* OPTION 2: BOOK ON WHATSAPP (NAVIGATES TO DEDICATED BOOKING PAGE) */}
            <button
              type="button"
              onClick={handleBookOnWhatsApp}
              className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 shadow-[0_4px_16px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_24px_rgba(16,185,129,0.5)] transition-all duration-200 active:scale-95 cursor-pointer flex items-center justify-center gap-2 group shrink-0 min-h-[44px]"
              title="Book directly on WhatsApp with pre-filled details"
            >
              <MessageCircle className="w-4 h-4 text-white transition-colors" />
              <span>Book on WhatsApp</span>
            </button>

            {/* OPTION 2: BOOK ONLINE */}
            {activeTab === 'self-drive-bike' ? (
              <button
                type="button"
                onClick={handleBookOnWhatsApp}
                className="w-full sm:w-auto px-6 py-3 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm text-white bg-amber-600 border border-amber-500 hover:bg-amber-700 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
              >
                <span>Pre-Book Bike Online</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={currentSelectedItem?.isAvailable === false}
                className={`w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm border transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 group relative overflow-hidden min-h-[44px] ${currentSelectedItem?.isAvailable === false
                    ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed opacity-75'
                    : 'text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 shadow-[0_6px_22px_rgba(37,99,235,0.4)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.55)] border-blue-400/30 cursor-pointer'
                  }`}
                title={
                  currentSelectedItem?.isAvailable === false
                    ? 'Selected vehicle is currently out of stock'
                    : 'Instant Online Reservation'
                }
              >
                {currentSelectedItem?.isAvailable === false ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                    <span>Vehicle Unavailable</span>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                    <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse" />
                    <span>Book Online</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </motion.div>
  );
};
