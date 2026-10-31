import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Clock, Car, CheckCircle2, ArrowRight, Lock } from 'lucide-react';
import { Container } from '../common/Container';
import { vehiclesAPI } from '../../services/api';
import { WhatsAppButton } from '../common/WhatsAppButton';
import { useAuth } from '../../hooks/useAuth';
import { AuthRequiredNotice } from '../common/AuthRequiredNotice';
import { getTodayDateString } from '../../utils/formatters';
import { BHUBANESWAR_LOCATIONS } from '../../config/bookingConfig';
import { SearchableLocationInput } from '../common/SearchableLocationInput';

export const CarDriverBookingBar = ({ selectedCar, onQuickBook }) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [fleet, setFleet] = useState([]);
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(() => getTodayDateString(1));
  const [time, setTime] = useState('10:00');
  const [carType, setCarType] = useState(selectedCar || '');
  const [bookedSubmitted, setBookedSubmitted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadFleet() {
      try {
        const res = await vehiclesAPI.getAll();
        if (res?.data && isMounted) {
          const list = res.data.map((c) => ({
            id: c.slug || c._id,
            _id: c._id,
            name: c.name,
            price: `₹${(c.pricing?.withDriver?.daily || (c.pricePerDay ? c.pricePerDay + 500 : 3499)).toLocaleString('en-IN')}/day`,
            type: c.type || c.category || 'Executive Sedan',
            isAvailable: c.isAvailable !== false,
            rawVehicle: c,
          }));
          setFleet(list);
          if (list.length > 0 && !carType) {
            setCarType(selectedCar || list[0].name);
          }
        }
      } catch (err) {
        console.error('Failed to load with-driver fleet for booking bar:', err);
      }
    }
    loadFleet();
    return () => {
      isMounted = false;
    };
  }, []);

  // Sync selectedCar prop when changed from vehicle cards
  useEffect(() => {
    if (selectedCar && fleet.some((c) => c.name === selectedCar && c.isAvailable !== false)) {
      setCarType(selectedCar);
    }
  }, [selectedCar, fleet]);

  const selectedVehicleObj = fleet.find((c) => c.name === carType) || fleet[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    if (onQuickBook) {
      onQuickBook({
        pickupLocation: pickup || 'SUM Hospital, Bhubaneswar',
        dropLocation: destination || 'Hotel / Office',
        pickupDate: date,
        serviceType: 'car-with-driver',
        vehicle: selectedVehicleObj,
      });
    } else {
      setBookedSubmitted(true);
    }
  };

  const whatsappMessage = `Hello CARZODRIVE! 👋\n\nI want to book a Car with Driver:\n🚗 Vehicle: ${carType}\n📍 Pickup: ${pickup || 'SUM Hospital, Bhubaneswar'}\n🏁 Destination: ${destination || 'Hotel / Office'}\n📅 Date: ${date}\n⏰ Time: ${time}\n\nPlease confirm availability and rate quote!`;

  return (
    <section id="booking-form-section" className="py-16 sm:py-20 bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9] to-[#f8fafc] text-slate-900 relative border-t border-slate-200/80">
      <Container>
        <div className="max-w-3xl mx-auto rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-10 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="text-center space-y-2 mb-8">
            <span className="text-xs font-black uppercase tracking-widest text-blue-600">
              DIRECT RESERVATION
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">
              Book With Driver
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Confirm your pickup details for instant driver assignment.
            </p>
          </div>

          {bookedSubmitted ? (
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold text-slate-900">Driver Request Queued!</h4>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                Your comfortable ride in the <strong className="text-slate-900">{carType}</strong> has been received. Our concierge officer will call you to confirm pickup coordinates.
              </p>
              
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <WhatsAppButton
                  message={whatsappMessage}
                  label="Confirm on WhatsApp"
                  size="md"
                  className="w-full sm:w-auto"
                />
                <button
                  type="button"
                  onClick={() => setBookedSubmitted(false)}
                  className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Modify Reservation
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 focus-within:bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15 transition-all shadow-xs">
                  <SearchableLocationInput
                    id="driver-booking-pickup"
                    label="Pickup Location / Address *"
                    value={pickup}
                    onChange={setPickup}
                    options={BHUBANESWAR_LOCATIONS}
                    placeholder="Type doorstep address or pick landmark..."
                    allowCustom={true}
                  />
                </div>

                <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 focus-within:bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/15 transition-all shadow-xs">
                  <SearchableLocationInput
                    id="driver-booking-dropoff"
                    label="Drop-off Destination *"
                    value={destination}
                    onChange={setDestination}
                    options={BHUBANESWAR_LOCATIONS}
                    placeholder="Type destination, hotel, or pick landmark..."
                    allowCustom={true}
                    includeSameAsPickup={true}
                    pickupLocationValue={pickup}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Pickup Date *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      min={getTodayDateString(0)}
                      value={date}
                      onChange={(e) => {
                        const val = e.target.value;
                        const today = getTodayDateString(0);
                        setDate(val && val < today ? today : val);
                      }}
                      className="w-full bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200/90 focus:border-blue-600 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-slate-900 font-semibold focus:outline-none transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Pickup Time *
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200/90 focus:border-blue-600 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-slate-900 font-semibold focus:outline-none transition-all shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Select Vehicle *
                  </label>
                  <div className="relative">
                    <Car className="w-4 h-4 text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <select
                      value={carType}
                      onChange={(e) => setCarType(e.target.value)}
                      className="w-full bg-slate-50/90 hover:bg-white focus:bg-white border border-slate-200/90 focus:border-blue-600 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-slate-900 font-bold focus:outline-none transition-all shadow-xs cursor-pointer"
                    >
                      {fleet.map((c) => (
                        <option
                          key={c.id || c.name}
                          value={c.name}
                          disabled={c.isAvailable === false}
                        >
                          {c.isAvailable !== false
                            ? `${c.name} — ${c.price} (${c.type})`
                            : `${c.name} — Currently Unavailable`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {!isAuthenticated && (
                <AuthRequiredNotice
                  title="Login Required to Book Car with Driver"
                  message="Please sign in or create an account to book your car with verified driver."
                  className="my-1 bg-amber-50 border-amber-200 text-amber-800"
                />
              )}

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                {!isAuthenticated ? (
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <Link
                      to="/login"
                      state={{ returnTo: '/car-with-driver' }}
                      className="flex-1 py-4 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Login to Confirm Driver Ride</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => openAuthModal('login')}
                      className="py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer shadow-xs"
                    >
                      Popup
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    className="flex-1 py-4 px-6 rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-sm transition-all shadow-lg shadow-blue-500/25 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Confirm Driver Ride</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <WhatsAppButton
                  message={whatsappMessage}
                  label="Book via WhatsApp"
                  variant="outline"
                  size="lg"
                  className="sm:w-auto justify-center bg-white border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white shadow-xs"
                />
              </div>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
};
