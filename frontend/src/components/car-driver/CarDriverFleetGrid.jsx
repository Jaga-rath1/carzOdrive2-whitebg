import React, { useState, useEffect } from 'react';
import { Award, Star, Globe, ArrowRight, Loader2 } from 'lucide-react';
import { Container } from '../common/Container';
import { WhatsAppButton } from '../common/WhatsAppButton';
import { vehiclesAPI } from '../../services/api';
import { useDriverSettings } from '../../hooks/useDriverSettings';
import { resolveVehicleImageUrl, getVehicleCardSrcSet, DEFAULT_CAR_IMAGE } from '../../utils/documentUtils';

export const CarDriverFleetGrid = ({ onSelectCar }) => {
  const { driverSettings } = useDriverSettings();
  const [withDriverCars, setWithDriverCars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const driverFee = driverSettings?.dailyRate || 799;
    vehiclesAPI
      .getAll()
      .then((res) => {
        if (isMounted && res?.data && res.data.length > 0) {
          const mapped = res.data.map((v) => {
            const baseRate = v.pricing?.dailyRate || v.pricePerDay || 1499;
            const withDriverRate = v.pricing?.dailyRateWithFuel || (baseRate + driverFee);
            const rawImg = (v.images && v.images[0]) || v.image;
            const image = resolveVehicleImageUrl(rawImg, DEFAULT_CAR_IMAGE, { width: 900, height: 560, crop: 'fill', gravity: 'auto', quality: 'auto:best' });
            const imageSrcSet = getVehicleCardSrcSet(rawImg, 800, 16 / 10);

            const stockCount = v.quantity !== undefined ? Number(v.quantity) : (v.availableCount ?? (v.isAvailable !== false ? 1 : 0));
            const isAvail = v.isAvailable !== false && stockCount > 0 && v.availabilityStatus !== 'Currently Unavailable';

            return {
              id: v.slug || v._id || v.id,
              rawId: v._id || v.id,
              name: v.name,
              type: v.type || v.model || `${v.category || 'Executive'} Sedan`,
              seats: `${v.seats || 5} Seats`,
              price: `₹${withDriverRate.toLocaleString('en-IN')} / day`,
              priceNumeric: withDriverRate,
              image: image,
              imageSrcSet: imageSrcSet,
              color: v.color || 'Executive Finish',
              badge: v.badge || (isAvail ? 'Verified Driver' : 'Reserved'),
              quantity: stockCount,
              availableCount: stockCount,
              isAvailable: isAvail,
              availabilityStatus: isAvail ? 'Available' : 'Currently Unavailable',
              driver: {
                name: 'Professional Odisha Driver',
                experience: '8+ Years Experience',
                rating: 4.98,
                languages: 'Odia, Hindi, English',
                availability: 'Assigned with vehicle',
              },
              rawVehicle: v,
            };
          });
          const sorted = mapped.sort((a, b) => {
            if (a.isAvailable === b.isAvailable) return 0;
            return a.isAvailable ? -1 : 1;
          });
          setWithDriverCars(sorted);
          setLoading(false);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load cars with driver from DB:', err);
        setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="py-16 sm:py-24">
      <Container>
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">
            Prestige Cars & Professional Drivers
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium">
            Hand-picked executive vehicles paired with experienced, vetted drivers directly from our database.
          </p>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm font-bold text-slate-500">Loading cars with driver from database...</p>
          </div>
        ) : withDriverCars.length === 0 ? (
          <div className="py-16 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-8">
            <p className="text-slate-600 font-bold text-sm">No vehicles currently available for car with driver service.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {withDriverCars.map((item) => {
            const isUnavailable = item.isAvailable === false;

            return (
              <div
                key={item.id}
                className={`rounded-3xl bg-white border shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 overflow-hidden flex flex-col justify-between ${
                  isUnavailable
                    ? 'border-slate-200/70 opacity-90'
                    : 'border-slate-200/90 hover:shadow-[0_16px_40px_rgba(37,99,235,0.15)] hover:border-blue-500'
                }`}
              >
                {/* Vehicle Image Header */}
                <div className="relative h-60 w-full overflow-hidden bg-slate-100">
                  <img
                    src={item.image}
                    srcSet={item.imageSrcSet || undefined}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                    alt={item.name}
                    className={`w-full h-full object-cover will-change-transform ${isUnavailable ? 'grayscale-[35%] opacity-85' : ''}`}
                    style={{
                      imageRendering: '-webkit-optimize-contrast',
                      WebkitBackfaceVisibility: 'hidden',
                      backfaceVisibility: 'hidden',
                      transform: 'translateZ(0)',
                    }}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent pointer-events-none" />
                  
                  {/* Status & Type Pill */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/90 text-slate-900 shadow-xs">
                      {item.type}
                    </span>
                    {isUnavailable && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-600 text-white shadow-sm border border-rose-400/50">
                        Currently Unavailable
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-3 right-3 text-right">
                    <span className="text-xl font-black text-white drop-shadow-md block">
                      {item.price}
                    </span>
                    {isUnavailable && (
                      <span className="text-[10px] font-extrabold text-rose-300 tracking-wide uppercase">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black text-slate-950">{item.name}</h3>
                      {isUnavailable && (
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                          Unavailable
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{item.seats}</p>
                  </div>

                  {/* Driver Information Card Box */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-black text-slate-900">
                          Driver: {item.driver.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{item.driver.rating}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-medium pt-1">
                      <div>Exp: <strong className="text-slate-900">{item.driver.experience}</strong></div>
                      <div>
                        Status:{' '}
                        {isUnavailable ? (
                          <span className="text-rose-600 font-bold">Currently Unavailable</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">{item.driver.availability}</span>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center gap-1 text-slate-500">
                        <Globe className="w-3 h-3 text-blue-600" />
                        <span>Languages: {item.driver.languages}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {isUnavailable ? (
                      <button
                        type="button"
                        disabled
                        className="flex-1 py-3.5 px-3 rounded-xl font-bold text-xs text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed flex items-center justify-center gap-2 select-none"
                      >
                        <span>Currently Unavailable</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectCar(item.name)}
                        className="flex-1 py-3.5 px-3 rounded-xl font-black text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 group"
                      >
                        <span>Reserve with Driver</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </button>
                    )}

                    <WhatsAppButton
                      message={
                        isUnavailable
                          ? `Hello CARZODRIVE! I am inquiring about future availability of ${item.name} (${item.type}) with driver service.`
                          : `Hello CARZODRIVE! I want to book a car with driver: ${item.name} (${item.type}) with driver ${item.driver.name}.`
                      }
                      variant="icon-only"
                      size="md"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </Container>
    </section>
  );
};
