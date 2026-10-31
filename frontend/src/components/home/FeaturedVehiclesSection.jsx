import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, Fuel, Gauge, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { Container } from '../common/Container';
import { WhatsAppButton } from '../common/WhatsAppButton';
import { getVehicleWhatsAppMessage } from '../../utils/whatsapp';
import { vehiclesAPI, bikesAPI } from '../../services/api';
import { resolveVehicleImageUrl, getVehicleFallbackImage, getVehicleCardSrcSet, DEFAULT_CAR_IMAGE, DEFAULT_BIKE_IMAGE, DEFAULT_FLEET_CARS, DEFAULT_FLEET_BIKES } from '../../utils/documentUtils';
import { useDiscount } from '../../hooks/useDiscount';
import { useAuth } from '../../hooks/useAuth';

export const FeaturedVehiclesSection = ({ onQuickBook }) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [activeCategory, setActiveCategory] = useState('Available Now');
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { calculateDiscount, isDiscountActive, badgeText } = useDiscount();

  useEffect(() => {
    let isMounted = true;
    async function loadFleet() {
      try {
        const [carsResult, bikesResult] = await Promise.allSettled([
          vehiclesAPI.getAll(),
          bikesAPI.getAll(),
        ]);

        const rawCars = (carsResult.status === 'fulfilled' && Array.isArray(carsResult.value?.data) && carsResult.value.data.length > 0)
          ? carsResult.value.data
          : DEFAULT_FLEET_CARS;

        const rawBikes = (bikesResult.status === 'fulfilled' && Array.isArray(bikesResult.value?.data) && bikesResult.value.data.length > 0)
          ? bikesResult.value.data
          : DEFAULT_FLEET_BIKES;

        const carItems = rawCars.map((v) => ({
          id: v._id || v.id,
          rawId: v._id || v.id,
          catalogId: v.slug || v._id || v.id,
          name: v.name,
          brand: v.brand || 'Premium',
          type: v.type || v.model || v.category || 'Hatchback',
          category:
            (v.category || '').toLowerCase() === 'suv'
              ? 'SUV'
              : (v.category || '').toLowerCase() === 'luxury'
                ? 'Luxury'
                : (v.category || '').toLowerCase() === 'sedan'
                  ? 'Sedan'
                  : 'Hatchback',
          color: v.color || 'Standard',
          year: v.year || 2024,
          quantity: v.quantity !== undefined ? Number(v.quantity) : (v.availableCount ?? v.count ?? (v.isAvailable !== false ? 1 : 0)),
          availableCount: v.quantity !== undefined ? Number(v.quantity) : (v.availableCount ?? v.count ?? (v.isAvailable !== false ? 1 : 0)),
          isAvailable: v.isAvailable !== false && (v.quantity !== undefined ? Number(v.quantity) : (v.availableCount ?? v.count ?? 1)) > 0 && v.availabilityStatus !== 'UNAVAILABLE' && v.availabilityStatus !== 'Currently Unavailable',
          image: resolveVehicleImageUrl((v.images && v.images[0]) || v.image, DEFAULT_CAR_IMAGE, { width: 900, height: 560, crop: 'fill', gravity: 'auto', quality: 'auto:best' }),
          imageSrcSet: getVehicleCardSrcSet((v.images && v.images[0]) || v.image, 800, 16 / 10),
          seats: typeof v.seats === 'number' ? `${v.seats} Seats` : (v.seats || '5 Seats'),
          fuel: v.fuelType ? v.fuelType.charAt(0).toUpperCase() + v.fuelType.slice(1) : (v.fuel || 'Petrol'),
          transmission: v.transmission ? v.transmission.charAt(0).toUpperCase() + v.transmission.slice(1) : 'Manual / AMT',
          pricePerDay: `₹${(v.pricing?.dailyRate || v.pricePerDay || v.priceNumeric || 1499).toLocaleString('en-IN')}`,
          priceNumeric: v.pricing?.dailyRate || v.pricePerDay || v.priceNumeric || 1499,
          badge: v.badge || (v.isAvailable !== false ? 'Live in Hub' : 'Reserved'),
          rawVehicle: v,
          vehicleType: 'car',
        }));

        const bikeItems = rawBikes.map((b) => ({
          id: b._id || b.id,
          rawId: b._id || b.id,
          catalogId: b.slug || b._id || b.id,
          name: b.name,
          brand: b.brand || 'Hero',
          type: b.model || b.category || 'Two Wheeler',
          category: 'Bike',
          color: b.color || 'Standard',
          year: b.year || 2024,
          quantity: b.quantity !== undefined ? Number(b.quantity) : (b.availableCount ?? b.count ?? (b.isAvailable !== false ? 1 : 0)),
          availableCount: b.quantity !== undefined ? Number(b.quantity) : (b.availableCount ?? b.count ?? (b.isAvailable !== false ? 1 : 0)),
          isAvailable: b.isAvailable !== false && (b.quantity !== undefined ? Number(b.quantity) : (b.availableCount ?? b.count ?? 1)) > 0 && b.availabilityStatus !== 'UNAVAILABLE' && b.availabilityStatus !== 'Currently Unavailable',
          image: resolveVehicleImageUrl((b.images && b.images[0]) || b.image, DEFAULT_BIKE_IMAGE, { width: 900, height: 560, crop: 'fill', gravity: 'auto', quality: 'auto:best' }),
          imageSrcSet: getVehicleCardSrcSet((b.images && b.images[0]) || b.image, 800, 16 / 10),
          seats: '2 Seats',
          fuel: 'Petrol',
          transmission: b.transmission || 'Manual',
          pricePerDay: `₹${(b.pricing?.dailyRate || b.pricePerDay || b.priceNumeric || 499).toLocaleString('en-IN')}`,
          priceNumeric: b.pricing?.dailyRate || b.pricePerDay || b.priceNumeric || 499,
          badge: b.badge || 'Two Wheeler',
          rawVehicle: b,
          vehicleType: 'bike',
        }));

        if (isMounted) {
          const combined = [...carItems, ...bikeItems].sort((a, b) => {
            if (a.isAvailable === b.isAvailable) return 0;
            return a.isAvailable ? -1 : 1;
          });
          setVehicles(combined);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load fleet from database:', err);
        if (isMounted) {
          const fallbackCars = DEFAULT_FLEET_CARS.map((v) => ({
            ...v,
            rawId: v.id,
            catalogId: v.slug || v.id,
            pricePerDay: `₹${v.priceNumeric.toLocaleString('en-IN')}`,
            vehicleType: 'car',
            rawVehicle: v,
          }));
          const fallbackBikes = DEFAULT_FLEET_BIKES.map((b) => ({
            ...b,
            rawId: b.id,
            catalogId: b.slug || b.id,
            category: 'Bike',
            pricePerDay: `₹${b.priceNumeric.toLocaleString('en-IN')}`,
            vehicleType: 'bike',
            rawVehicle: b,
          }));
          setVehicles([...fallbackCars, ...fallbackBikes]);
          setIsLoading(false);
        }
      }
    }

    loadFleet();
    return () => {
      isMounted = false;
    };
  }, []);

  const categories = ['Available Now', 'All Fleet', 'SUV', 'Sedan', 'Luxury', 'Bike'];

  const filteredVehicles = useMemo(() => {
    let list = [];
    if (activeCategory === 'All Fleet') {
      list = [...vehicles];
    } else if (activeCategory === 'Available Now') {
      list = vehicles.filter((v) => v.isAvailable);
    } else {
      list = vehicles.filter((v) => v.category === activeCategory);
    }

    return list.sort((a, b) => {
      if (a.isAvailable === b.isAvailable) return 0;
      return a.isAvailable ? -1 : 1;
    });
  }, [vehicles, activeCategory]);

  return (
    <section id="featured-vehicles" className="py-12 sm:py-16 bg-white relative">
      <Container>
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 sm:mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-black tracking-widest uppercase mb-3 border border-blue-200">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>THE CARZODRIVE FLEET</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-tight">
              Featured Cars.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700">
                Ready to Drive.
              </span>
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-xl font-normal">
              Every car and bike is verified, insured, and delivered to your doorstep in pristine condition directly from our live database.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/car-self-ride"
              className="inline-flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wider"
            >
              <span>Explore All Cars</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <span className="text-slate-300">•</span>
            <Link
              to="/bike-self-ride"
              className="inline-flex items-center gap-2 text-xs font-black text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wider"
            >
              <span>Explore All Bikes</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-10 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${activeCategory === cat
                  ? 'bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.35)]'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
            >
              {cat === 'All Fleet'
                ? '⚡ All Fleet'
                : cat === 'Available Now'
                  ? '🟢 Available Now'
                  : cat === 'Bike'
                    ? '🏍️ Bikes & Scooters'
                    : cat === 'Sedan'
                      ? 'Hatchback & Sedan'
                      : cat === 'Luxury'
                        ? 'Premium & 4x4'
                        : cat}
            </button>
          ))}
        </div>

        {/* Loading Spinner */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm font-bold text-slate-500">Connecting to database...</p>
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="py-16 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-8">
            <p className="text-slate-600 font-bold text-sm">No vehicles found in this category.</p>
          </div>
        ) : (
          /* Vehicles Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-7">
            <AnimatePresence mode="popLayout">
              {filteredVehicles.map((vehicle) => {
                const detailTarget = `/vehicle/${vehicle.catalogId || vehicle.id}`;

                return (
                  <motion.div
                    key={vehicle.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3 }}
                    className="group relative flex flex-col justify-between rounded-3xl bg-white border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgba(37,99,235,0.16)] hover:border-blue-500 transition-all duration-300 overflow-hidden"
                  >
                    {/* Card Image */}
                    <Link to={detailTarget} className="relative h-56 w-full overflow-hidden bg-slate-100 block">
                      <img
                        src={vehicle.image}
                        srcSet={vehicle.imageSrcSet || undefined}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                        alt={vehicle.name}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform"
                        style={{
                          imageRendering: '-webkit-optimize-contrast',
                          WebkitBackfaceVisibility: 'hidden',
                          backfaceVisibility: 'hidden',
                          transform: 'translateZ(0)',
                        }}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = getVehicleFallbackImage(vehicle);
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/25 via-transparent to-transparent pointer-events-none" />

                      {/* Top Badges */}
                      <div className="absolute top-4 left-4 flex flex-col gap-1 items-start">
                        <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/90 text-slate-900 shadow-xs">
                          {vehicle.badge || vehicle.type}
                        </span>
                        {vehicle.isAvailable ? (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/90 text-white shadow-sm flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            {vehicle.availableCount ? `${vehicle.availableCount} Available` : 'Available'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-600 text-white shadow-sm">
                            Currently Unavailable
                          </span>
                        )}
                      </div>

                      {/* Price Badge with Live Discount */}
                      <div className="absolute bottom-4 right-4 text-right">
                        {isDiscountActive && vehicle.priceNumeric ? (
                          (() => {
                            const disc = calculateDiscount(vehicle.priceNumeric, vehicle.category === 'bike' ? 'self-drive-bike' : 'self-drive-car');
                            return (
                              <div className="flex flex-col items-end">
                                {disc.discountAmount > 0 && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-slate-300 line-through drop-shadow">
                                      ₹{vehicle.priceNumeric.toLocaleString('en-IN')}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-black uppercase shadow-xs">
                                      {disc.badgeText.includes('%') ? disc.badgeText : `${disc.badgeText} (${disc.discountPercent}% OFF)`}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-baseline">
                                  <span className="text-2xl font-black text-white drop-shadow-md">
                                    ₹{disc.finalAmount.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-xs text-slate-300 ml-1">/ day</span>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <>
                            <span className="text-2xl font-black text-white drop-shadow-md">
                              {vehicle.pricePerDay}
                            </span>
                            <span className="text-xs text-slate-300 ml-1">/ day</span>
                          </>
                        )}
                      </div>
                    </Link>

                    {/* Card Content */}
                    <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                            {vehicle.type}
                          </span>
                          <span className="text-xs font-semibold text-slate-500">
                            {vehicle.color} • {vehicle.year}
                          </span>
                        </div>
                        <h3 className="text-xl font-black text-slate-950 mt-1 group-hover:text-blue-600 transition-colors">
                          {vehicle.name}
                        </h3>
                      </div>

                      {/* Specs Row */}
                      <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700">
                        <div className="flex items-center gap-1.5 truncate">
                          <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{vehicle.seats}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <Fuel className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{vehicle.fuel}</span>
                        </div>
                        <div className="flex items-center gap-1.5 truncate">
                          <Gauge className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{vehicle.transmission}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <Link
                          to={detailTarget}
                          onClick={(e) => {
                            if (!isAuthenticated) {
                              e.preventDefault();
                              openAuthModal('login');
                            }
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 hover:border-blue-500 font-bold text-xs text-slate-700 hover:text-blue-600 transition-all cursor-pointer text-center bg-slate-50 hover:bg-white"
                        >
                          View Details
                        </Link>

                        <WhatsAppButton
                          message={getVehicleWhatsAppMessage(vehicle)}
                          variant="icon-only"
                          size="md"
                        />

                        {vehicle.isAvailable ? (
                          <button
                            type="button"
                            onClick={() =>
                              onQuickBook
                                ? onQuickBook({
                                  ...vehicle,
                                  id: vehicle.catalogId || vehicle.id,
                                  vehicleId: vehicle.rawId || vehicle.id,
                                  _id: vehicle.rawId || vehicle.id,
                                })
                                : null
                            }
                            className="flex-1 py-2.5 px-3 rounded-xl font-black text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 transition-all shadow-md cursor-pointer text-center"
                          >
                            Book Ride
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="flex-1 py-2.5 px-2 rounded-xl font-black text-xs text-rose-500 bg-rose-50 border border-rose-200 cursor-not-allowed select-none text-center"
                            title="This vehicle has 0 units available and is currently unavailable"
                          >
                            Currently Unavailable
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </Container>
    </section>
  );
};
