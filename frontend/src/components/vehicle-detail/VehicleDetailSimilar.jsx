import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { WhatsAppButton } from '../common/WhatsAppButton';
import { getVehicleWhatsAppMessage } from '../../utils/whatsapp';
import { vehiclesAPI, bikesAPI } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { DEFAULT_CAR_IMAGE, DEFAULT_BIKE_IMAGE, resolveVehicleImageUrl, getVehicleCardSrcSet } from '../../utils/documentUtils';

export const VehicleDetailSimilar = ({ currentVehicle, onOpenQuickBook }) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const isBike = currentVehicle?.vehicleType === 'bike';
  const [similarVehicles, setSimilarVehicles] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchSimilar = isBike ? bikesAPI.getAll() : vehiclesAPI.getAll();

    fetchSimilar
      .then((res) => {
        if (isMounted && res?.data && res.data.length > 0) {
          const filtered = res.data
            .filter((v) => (v.slug || v._id || v.id) !== (currentVehicle?.slug || currentVehicle?.id || currentVehicle?._id))
            .slice(0, 3)
            .map((v) => {
              const price = v.pricing?.dailyRate || v.pricePerDay || (isBike ? 499 : 1499);
              const fallbackImg = isBike ? DEFAULT_BIKE_IMAGE : DEFAULT_CAR_IMAGE;
              const rawImg = (v.images && v.images[0]) || v.image;
              const image = resolveVehicleImageUrl(rawImg, fallbackImg, { width: 900, height: 560, crop: 'fill', gravity: 'auto', quality: 'auto:best' });
              const imageSrcSet = getVehicleCardSrcSet(rawImg, 800, 16 / 10);
              const count = v.quantity !== undefined ? Number(v.quantity) : (v.availableCount ?? v.count ?? (v.isAvailable !== false ? 1 : 0));
              const isAvail = v.isAvailable !== false && count > 0 && v.availabilityStatus !== 'UNAVAILABLE' && v.availabilityStatus !== 'Currently Unavailable';

              return {
                id: v.slug || v._id || v.id,
                _id: v._id || v.id,
                vehicleId: v._id || v.id,
                name: v.name,
                brand: v.brand || 'Premium',
                category: v.category || (isBike ? 'Bike' : 'Sedan'),
                vehicleType: isBike ? 'bike' : 'car',
                color: v.color || 'Standard',
                image,
                imageSrcSet,
                pricePerDay: price,
                priceDisplay: `₹${price.toLocaleString('en-IN')}`,
                badge: v.badge || (isAvail ? 'Verified' : 'Reserved'),
                isAvailable: isAvail,
                quantity: count,
                availableCount: count,
                availabilityStatus: isAvail ? 'Available' : 'Currently Unavailable',
                rawVehicle: v,
              };
            });

          setSimilarVehicles(filtered);
        }
      })
      .catch((err) => {
        console.error('Failed to load similar vehicles from DB:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [currentVehicle, isBike]);

  if (similarVehicles.length === 0) return null;

  return (
    <section className="pt-16 mt-16 border-t border-slate-200">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-black text-slate-950">
            Similar {isBike ? 'Bikes' : 'Cars'} You Might Like
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Compare other benchmark options available in our database.
          </p>
        </div>
        <Link
          to={isBike ? '/bike-self-ride' : '/car-self-ride'}
          className="text-xs font-black text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {similarVehicles.map((item) => (
          <div
            key={item.id}
            className="group flex flex-col justify-between rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-blue-500 transition-all duration-300 overflow-hidden"
          >
            <div className="relative h-48 w-full overflow-hidden bg-slate-100">
              <img
                src={item.image}
                srcSet={item.imageSrcSet || undefined}
                sizes="(max-width: 768px) 100vw, 33vw"
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                loading="lazy"
                decoding="async"
                style={{ imageRendering: '-webkit-optimize-contrast', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent pointer-events-none" />

              <div className="absolute top-3 left-3">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/90 text-slate-900 shadow-xs">
                  {item.badge || item.category}
                </span>
              </div>

              <div className="absolute bottom-3 right-3 text-right">
                <span className="text-lg font-black text-white drop-shadow-md">
                  {item.priceDisplay}
                </span>
                <span className="text-[10px] text-slate-300 ml-1">/ day</span>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                    {item.brand}
                  </span>
                  {item.color && (
                    <span className="text-[10px] font-semibold text-slate-500">
                      {item.color}
                    </span>
                  )}
                </div>
                <h4 className="text-base font-black text-slate-950 mt-0.5 group-hover:text-blue-600 transition-colors">
                  {item.name}
                </h4>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Link
                  to={`/vehicle/${item.id}`}
                  onClick={(e) => {
                    if (!isAuthenticated) {
                      e.preventDefault();
                      openAuthModal('login');
                    }
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 hover:border-blue-500 font-bold text-xs text-slate-700 hover:text-blue-600 transition-all text-center bg-slate-50 hover:bg-white cursor-pointer"
                >
                  View Details
                </Link>

                <WhatsAppButton
                  message={getVehicleWhatsAppMessage(item)}
                  variant="icon-only"
                  size="md"
                />

                {item.isAvailable ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenQuickBook?.({
                        vehicle: item,
                        type: item.vehicleType,
                        vehicleId: item.rawId || item.id,
                        _id: item.rawId || item.id,
                      })
                    }
                    className="py-2.5 px-4 rounded-xl font-black text-xs text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm cursor-pointer"
                  >
                    Book
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="py-2.5 px-2 rounded-xl font-black text-xs text-rose-500 bg-rose-50 border border-rose-200 cursor-not-allowed select-none text-center"
                    title="This vehicle has 0 units available and is currently unavailable"
                  >
                    Currently Unavailable
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
