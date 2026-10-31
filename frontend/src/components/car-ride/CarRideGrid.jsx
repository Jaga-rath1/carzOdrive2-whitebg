import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, Fuel, Gauge, SlidersHorizontal, Loader2 } from 'lucide-react';
import { Container } from '../common/Container';
import { WhatsAppButton } from '../common/WhatsAppButton';
import { getVehicleWhatsAppMessage } from '../../utils/whatsapp';
import { vehiclesAPI } from '../../services/api';
import { resolveVehicleImageUrl, getVehicleCardSrcSet, DEFAULT_CAR_IMAGE, DEFAULT_FLEET_CARS } from '../../utils/documentUtils';
import { CarRideCard } from './CarRideCard';

export const CarRideGrid = ({ onOpenQuickBook, onOpenSpecs }) => {
  const [activeCategory, setActiveCategory] = useState('Available Now');
  const [sortBy, setSortBy] = useState('popular');
  const [fleetCars, setFleetCars] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const mapCars = (list) => {
      return list.map((v) => {
        const price = v.pricing?.dailyRate || v.pricePerDay || v.priceNumeric || 1499;
        const rawImage = (v.images && v.images[0]) || v.image;
        const image = resolveVehicleImageUrl(rawImage, DEFAULT_CAR_IMAGE, { width: 900, height: 560, crop: 'fill', gravity: 'auto', quality: 'auto:best' });
        const imageSrcSet = getVehicleCardSrcSet(rawImage, 800, 16 / 10);

        return {
          id: v.slug || v._id || v.id,
          rawId: v._id || v.id,
          vehicleId: v._id || v.id,
          name: v.name,
          category:
            (v.category || '').toLowerCase() === 'suv'
              ? 'SUV'
              : (v.category || '').toLowerCase() === 'sedan'
              ? 'Sedan'
              : (v.category || '').toLowerCase() === 'luxury'
              ? 'Luxury'
              : 'Hatchback',
          seats: v.specs?.seats || v.seatsCount || v.seats || 5,
          fuel: v.specs?.fuelType || (v.fuelType ? v.fuelType.toUpperCase() : (v.fuel ? v.fuel.toUpperCase() : 'PETROL')),
          transmission: v.specs?.transmission || (v.transmission ? v.transmission.toUpperCase() : 'MANUAL'),
          pricePerDay: price,
          priceDisplay: `₹${price.toLocaleString('en-IN')}`,
          popularity: v.isAvailable !== false ? 100 : 70,
          isLuxury: (v.category || '').toLowerCase() === 'luxury',
          image: image,
          imageSrcSet: imageSrcSet,
          badge: v.badge || (v.isAvailable !== false ? 'Live in Hub' : 'Reserved'),
          quantity: v.quantity !== undefined ? Number(v.quantity) : (v.availableCount ?? v.count ?? (v.isAvailable !== false ? 1 : 0)),
          availableCount: v.quantity !== undefined ? Number(v.quantity) : (v.availableCount ?? v.count ?? (v.isAvailable !== false ? 1 : 0)),
          isAvailable: v.isAvailable !== false && (v.quantity !== undefined ? Number(v.quantity) : (v.availableCount ?? v.count ?? 1)) > 0 && v.availabilityStatus !== 'UNAVAILABLE' && v.availabilityStatus !== 'Currently Unavailable',
          availabilityStatus: (v.isAvailable !== false && (v.quantity !== undefined ? Number(v.quantity) : (v.availableCount ?? v.count ?? 1)) > 0 && v.availabilityStatus !== 'UNAVAILABLE' && v.availabilityStatus !== 'Currently Unavailable') ? 'Available' : 'Currently Unavailable',
          color: v.color || v.specs?.color || 'Standard',
          year: v.year || 2024,
          rawVehicle: v,
          vehicleType: 'car',
        };
      });
    };

    vehiclesAPI
      .getAll()
      .then((res) => {
        if (!isMounted) return;
        const rawList = (res?.data && Array.isArray(res.data) && res.data.length > 0)
          ? res.data
          : DEFAULT_FLEET_CARS;

        const mapped = mapCars(rawList);
        const sorted = mapped.sort((a, b) => {
          if (a.isAvailable === b.isAvailable) return 0;
          return a.isAvailable ? -1 : 1;
        });
        setFleetCars(sorted);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load cars from DB:', err);
        if (isMounted) {
          const mapped = mapCars(DEFAULT_FLEET_CARS);
          setFleetCars(mapped);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const categories = ['Available Now', 'All', 'Hatchback', 'SUV', 'Sedan', 'Luxury'];

  const filteredAndSortedCars = useMemo(() => {
    let result = [...fleetCars];
    if (activeCategory === 'Available Now') {
      result = result.filter((c) => c.isAvailable);
    } else if (activeCategory !== 'All') {
      result = result.filter((c) => c.category === activeCategory);
    }

    if (sortBy === 'price-low') {
      result.sort((a, b) => a.pricePerDay - b.pricePerDay);
    } else if (sortBy === 'price-high') {
      result.sort((a, b) => b.pricePerDay - a.pricePerDay);
    } else if (sortBy === 'seats') {
      result.sort((a, b) => b.seats - a.seats);
    } else {
      result.sort((a, b) => b.popularity - a.popularity);
    }

    // Always keep available vehicles on top, unavailable at the bottom
    result.sort((a, b) => {
      if (a.isAvailable === b.isAvailable) return 0;
      return a.isAvailable ? -1 : 1;
    });

    return result;
  }, [fleetCars, activeCategory, sortBy]);

  return (
    <section className="py-16 sm:py-24">
      <Container>
        {/* Controls: Filter Pills + Sort Dropdown */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white shadow-[0_4px_15px_rgba(37,99,235,0.35)]'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {cat === 'Available Now' ? '🟢 Available Now' : cat}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              <span>Sort by:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-hidden cursor-pointer"
            >
              <option value="popular">Popularity</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="seats">Seating Capacity</option>
            </select>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm font-bold text-slate-500">Loading fleet from database...</p>
          </div>
        ) : filteredAndSortedCars.length === 0 ? (
          <div className="py-16 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-8">
            <p className="text-slate-600 font-bold text-sm">No vehicles found in this category.</p>
          </div>
        ) : (
          /* Cars Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredAndSortedCars.map((vehicle) => (
                <motion.div
                  key={vehicle.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3 }}
                >
                  <CarRideCard
                    vehicle={vehicle}
                    onOpenQuickBook={onOpenQuickBook}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Container>
    </section>
  );
};
