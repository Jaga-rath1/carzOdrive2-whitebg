import React, { useState } from 'react';
import { 
  Calendar, 
  MapPin, 
  ShieldCheck, 
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Coins,
  MessageCircle,
  Sparkles
} from 'lucide-react';
import { WhatsAppButton, WhatsAppIcon } from '../common/WhatsAppButton';
import { getVehicleWhatsAppMessage } from '../../utils/whatsapp';
import { BHUBANESWAR_LOCATIONS } from '../../config/bookingConfig';
import { getTodayDateString } from '../../utils/formatters';
import { useDiscount } from '../../hooks/useDiscount';
import { VehicleWhatsAppModal } from './VehicleWhatsAppModal';
import { SearchableLocationInput } from '../common/SearchableLocationInput';

export const VehicleDetailBookingBox = ({ vehicle, onOpenQuickBook }) => {
  const count = vehicle.quantity !== undefined ? Number(vehicle.quantity) : (vehicle.availableCount ?? vehicle.count ?? (vehicle.isAvailable !== false ? 1 : 0));
  const isAvailable = vehicle.isAvailable !== false && count > 0 && vehicle.availabilityStatus !== 'UNAVAILABLE' && vehicle.availabilityStatus !== 'Currently Unavailable';

  const [pickupDate, setPickupDate] = useState(() => getTodayDateString(1));
  const [returnDate, setReturnDate] = useState(() => getTodayDateString(3));
  const [pickupLocation, setPickupLocation] = useState('SUM Hospital');
  const [paymentMode, setPaymentMode] = useState('offline'); // Default to offline (WhatsApp)
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  // Calculate day difference
  const daysDiff = Math.max(
    1,
    Math.round(
      (new Date(returnDate).getTime() - new Date(pickupDate).getTime()) /
        (1000 * 60 * 60 * 24)
    ) || 2
  );

  const priceNum = vehicle.priceNumeric || (
    typeof vehicle.pricePerDay === 'number' 
      ? vehicle.pricePerDay 
      : parseInt(String(vehicle.pricePerDay).replace(/[^0-9]/g, '')) || 2999
  );

  const { calculateDiscount, discountPercentage } = useDiscount();
  const serviceType = vehicle.vehicleType === 'bike' ? 'self-drive-bike' : 'self-drive-car';
  const priceCalc = calculateDiscount(priceNum, serviceType);

  const originalEstimatedTotal = priceNum * daysDiff;
  const totalDiscount = priceCalc.isDiscountActive ? priceCalc.discountAmount * daysDiff : 0;
  const estimatedTotal = originalEstimatedTotal - totalDiscount;

  const partialAmount = Math.max(499, Math.round(estimatedTotal * 0.25));
  const remainingAmount = Math.max(0, estimatedTotal - partialAmount);
  const depositText = vehicle.deposit || (vehicle.depositNumeric ? `₹${vehicle.depositNumeric}` : '₹5,000');

  const effectiveLocation = pickupLocation;

  const handleBookNow = () => {
    if (!isAvailable) return;
    const today = getTodayDateString(0);
    if (!pickupDate || pickupDate < today) {
      alert('Back-dated bookings are not allowed. Please choose today or a future date.');
      setPickupDate(today);
      return;
    }
    if (returnDate && returnDate < pickupDate) {
      alert('Drop-off date cannot be earlier than pick-up date.');
      setReturnDate(pickupDate);
      return;
    }
    onOpenQuickBook?.({
      vehicle: {
        ...vehicle,
        pricePerDay: priceCalc.isDiscountActive ? priceCalc.finalAmount : priceNum,
        originalPricePerDay: priceNum,
        discountApplied: priceCalc.isDiscountActive,
      },
      type: vehicle.vehicleType || 'vehicle',
      pickupDate,
      returnDate,
      location: effectiveLocation,
      pickupLocation: effectiveLocation,
      paymentMode,
      totalAmount: estimatedTotal,
      discountAmount: totalDiscount,
    });
  };

  return (
    <div className="sticky top-28 rounded-3xl bg-white border border-slate-200/90 shadow-[0_12px_40px_rgba(0,0,0,0.08)] p-6 space-y-6">
      {/* Price Header */}
      <div className="pb-5 border-b border-slate-100 flex items-end justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            Rental Rate
          </span>
          {priceCalc.isDiscountActive && priceCalc.discountAmount > 0 ? (
            <div className="mt-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm text-slate-400 line-through font-bold">
                  ₹{priceNum.toLocaleString('en-IN')}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-200" />
                  <span>{priceCalc.badgeText} ({discountPercentage}% OFF)</span>
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black text-emerald-600">
                  ₹{priceCalc.finalAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-xs font-semibold text-slate-500">/ 24 hours</span>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl sm:text-4xl font-black text-slate-950">
                {vehicle.priceDisplay || `₹${priceNum.toLocaleString('en-IN')}`}
              </span>
              <span className="text-xs font-semibold text-slate-500">/ 24 hours</span>
            </div>
          )}
          {vehicle.color && (
            <span className="text-[11px] font-semibold text-slate-500 block mt-1">
              Color: <strong className="text-slate-800">{vehicle.color}</strong>
            </span>
          )}
          <div className="mt-2">
            {isAvailable ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {count} Units Available
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Currently Unavailable (0 Units)
              </span>
            )}
          </div>
        </div>


        <div className="text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 block mb-1">
            Refundable Deposit
          </span>
          <span className="text-xs font-bold text-slate-700">
            {depositText}
          </span>
        </div>
      </div>

      {/* Date & Hub Pickers */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-blue-600" />
              Pick-up
            </label>
            <input
              type="date"
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
              className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
            />
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-blue-600" />
              Drop-off
            </label>
            <input
              type="date"
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
              className="w-full bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15 transition-all space-y-1">
          <SearchableLocationInput
            id="detail-pickup-location"
            label="Pick-up / Delivery Location"
            value={pickupLocation}
            onChange={setPickupLocation}
            options={BHUBANESWAR_LOCATIONS}
            placeholder="Type address or pick landmark..."
            allowCustom={true}
          />
        </div>
      </div>

      {/* Payment Options Selection */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
          Payment Preference
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {/* Option 1: Full Pay (Disabled/Faded) */}
          <div
            className="p-2 rounded-xl text-center border border-slate-200 bg-slate-100/60 text-slate-400 opacity-40 cursor-not-allowed select-none"
            title="Online payment temporarily disabled. Please book via WhatsApp."
          >
            <div className="text-[11px] font-bold leading-tight">Full Pay</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Disabled</div>
          </div>

          {/* Option 2: 25% Token (Disabled/Faded) */}
          <div
            className="p-2 rounded-xl text-center border border-slate-200 bg-slate-100/60 text-slate-400 opacity-40 cursor-not-allowed select-none"
            title="Partial payment temporarily disabled. Please book via WhatsApp."
          >
            <div className="text-[11px] font-bold leading-tight">25% Token</div>
            <div className="text-[9px] text-slate-400 mt-0.5">Disabled</div>
          </div>

          {/* Option 3: WhatsApp Booking (Active) */}
          <button
            type="button"
            onClick={() => setPaymentMode('offline')}
            className="p-2 rounded-xl text-center border border-emerald-600 bg-emerald-50/80 text-emerald-700 font-bold ring-1 ring-emerald-500/30 cursor-pointer shadow-xs"
          >
            <div className="text-[11px] font-bold leading-tight">WhatsApp</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Pay on Pickup</div>
          </button>
        </div>
      </div>

      {/* Fare Estimate with dynamic breakdown */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 text-xs space-y-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
          <div>
            <span className="font-bold text-slate-900 block">Total for {daysDiff} Days</span>
            <span className="text-[10px] text-slate-500">Includes all taxes & FASTag</span>
          </div>
          <div className="text-right">
            {priceCalc.isDiscountActive && totalDiscount > 0 ? (
              <div>
                <span className="text-xs text-slate-400 line-through font-medium block">
                  ₹{originalEstimatedTotal.toLocaleString('en-IN')}
                </span>
                <span className="text-base font-black text-emerald-600">
                  ₹{estimatedTotal.toLocaleString('en-IN')}
                </span>
              </div>
            ) : (
              <span className="text-base font-black text-slate-900">
                ₹{estimatedTotal.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>

        {/* Highlighted Promotional Discount Cut Row */}
        {priceCalc.isDiscountActive && totalDiscount > 0 && (
          <div className="flex items-center justify-between font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
            <span className="text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Promotional Discount ({discountPercentage}% OFF):</span>
            </span>
            <span className="text-xs font-black">
              -₹{totalDiscount.toLocaleString('en-IN')}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between font-semibold pt-0.5">
          <span className="text-slate-600 text-[11px]">
            Pay Online Now:
          </span>
          <span className="text-sm font-black text-emerald-600">
            ₹0 (Zero Advance)
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Pay on Vehicle Handover:</span>
          <span className="font-bold text-slate-800">
            ₹{estimatedTotal.toLocaleString('en-IN')} (Cash / UPI)
          </span>
        </div>
      </div>

      {/* Primary Actions: Book Now + Chat on WhatsApp */}
      <div className="space-y-2.5">
        {isAvailable ? (
          <button
            type="button"
            onClick={handleBookNow}
            className="w-full py-4 px-6 rounded-2xl font-black text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-[0_6px_20px_rgba(16,185,129,0.3)] cursor-pointer flex items-center justify-center gap-2 group active:scale-98"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>Book on WhatsApp</span>
          </button>
        ) : (
          <div className="space-y-1.5">
            <button
              type="button"
              disabled
              className="w-full py-4 px-6 rounded-2xl font-black text-sm text-rose-500 bg-rose-50 border border-rose-200 cursor-not-allowed select-none text-center shadow-xs"
              title="This vehicle has 0 units available and is currently unavailable"
            >
              Currently Unavailable
            </button>
            <p className="text-[11px] text-rose-600 text-center font-medium">
              This vehicle currently has 0 units in stock and is unavailable for booking.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsWhatsAppModalOpen(true)}
          className="w-full rounded-2xl py-3.5 px-4 text-sm font-bold flex items-center justify-center gap-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-300 transition-all cursor-pointer shadow-xs active:scale-98"
          title="Chat directly with us on WhatsApp"
        >
          <WhatsAppIcon className="w-4 h-4 shrink-0" />
          <span>{isAvailable ? "Chat with Us on WhatsApp" : "Inquire Availability on WhatsApp"}</span>
        </button>
      </div>

      {/* Trust Badges */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Zero pre-payment required. Pay on vehicle handoff.</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Free cancellation up to 6 hours before trip starts.</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>100% verified CARZODRIVE commercial fleet.</span>
        </div>
      </div>

      {/* WhatsApp Inquiry Modal */}
      <VehicleWhatsAppModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        vehicle={vehicle}
        pickupDate={pickupDate}
        returnDate={returnDate}
        pickupLocation={effectiveLocation}
        daysDiff={daysDiff}
        estimatedTotal={estimatedTotal}
      />
    </div>
  );
};
