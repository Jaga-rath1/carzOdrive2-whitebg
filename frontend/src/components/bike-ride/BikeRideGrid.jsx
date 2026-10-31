import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Gauge, Fuel, Bike, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { Container } from '../common/Container';
import { WhatsAppButton } from '../common/WhatsAppButton';
import { getVehicleWhatsAppMessage } from '../../utils/whatsapp';
import { bikesAPI } from '../../services/api';
import { resolveVehicleImageUrl, getVehicleCardSrcSet, DEFAULT_BIKE_IMAGE } from '../../utils/documentUtils';
import { BikeRideCard } from './BikeRideCard';

const FALLBACK_BIKES = [
  {
    id: 'hero-splendor-plus',
    rawId: 'hero-splendor-plus',
    bikeId: 'hero-splendor-plus',
    name: 'Hero Splendor Plus XTEC',
    brand: 'Hero',
    category: 'Commuter',
    engine: '97.2 cc',
    mileage: '65 km/l',
    transmission: '4-Speed Manual',
    pricePerDay: '₹499',
    priceNumeric: 499,
    deposit: '₹1,500',
    depositNumeric: 1500,
    image: 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793262291/carzodrive/bikes/bike-main-1793262290712-a8c0708c.jpg',
    badge: 'Coming Soon - Pre-Book',
    isAvailable: true,
    availableCount: 20,
    availabilityStatus: 'Available',
    vehicleType: 'bike',
  },
  {
    id: 'honda-activa-6g',
    rawId: 'honda-activa-6g',
    bikeId: 'honda-activa-6g',
    name: 'Honda Activa 6G Scooty',
    brand: 'Honda',
    category: 'Scooter',
    engine: '109.5 cc',
    mileage: '55 km/l',
    transmission: 'Automatic CVT',
    pricePerDay: '₹549',
    priceNumeric: 549,
    deposit: '₹1,500',
    depositNumeric: 1500,
    image: 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793262145/carzodrive/bikes/bike-main-1793262144481-2bbb612b.jpg',
    badge: 'Coming Soon - Pre-Book',
    isAvailable: true,
    availableCount: 15,
    availabilityStatus: 'Available',
    vehicleType: 'bike',
  },
];

export const BikeRideGrid = ({ onOpenQuickBook }) => {
  const [activeCategory, setActiveCategory] = useState('Available Now');
  const [fleetBikes, setFleetBikes] = useState(FALLBACK_BIKES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    bikesAPI
      .getAll()
      .then((res) => {
        if (isMounted && res?.data && res.data.length > 0) {
          const mapped = res.data.map((b) => {
            const price = b.pricing?.dailyRate || b.pricePerDay || b.priceNumeric || 499;
            const deposit = b.pricing?.securityDeposit || b.depositNumeric || 1200;
            const rawImg = (b.images && b.images[0]) || b.image;
            const image = resolveVehicleImageUrl(rawImg, DEFAULT_BIKE_IMAGE, { width: 900, height: 560, crop: 'fill', gravity: 'auto', quality: 'auto:best' });
            const imageSrcSet = getVehicleCardSrcSet(rawImg, 800, 16 / 10);

            return {
              id: b.slug || b._id || b.id,
              rawId: b._id || b.id,
              bikeId: b._id || b.id,
              name: b.name,
              brand: b.brand,
              category:
                (b.category || '').toLowerCase() === 'scooter'
                  ? 'Scooter'
                  : (b.category || '').toLowerCase() === 'sports'
                  ? 'Sports'
                  : (b.category || '').toLowerCase() === 'cruiser' || (b.category || '').toLowerCase() === 'luxury'
                  ? 'Luxury'
                  : 'Commuter',
              engine: b.engineCC
                ? `${b.engineCC} cc`
                : b.engineCapacity
                ? (String(b.engineCapacity).includes('cc') ? b.engineCapacity : `${b.engineCapacity} cc`)
                : b.specs?.engine
                ? (String(b.specs.engine).includes('cc') ? b.specs.engine : `${b.specs.engine} cc`)
                : '350 cc',
              engineCC: b.engineCC || (b.engineCapacity ? parseInt(String(b.engineCapacity).replace(/[^0-9]/g, ''), 10) : 350) || 350,
              mileage: b.mileage ? (String(b.mileage).includes('km') ? b.mileage : `${b.mileage} km/l`) : b.specs?.mileage || '45 km/l',
              transmission: b.transmission || b.specs?.transmission || 'Manual',
              pricePerDay: `₹${price.toLocaleString('en-IN')}`,
              priceNumeric: price,
              deposit: `₹${deposit.toLocaleString('en-IN')}`,
              depositNumeric: deposit,
              image: image,
              imageSrcSet: imageSrcSet,
              badge: b.badge || (b.isAvailable !== false ? 'Live in Hub' : 'Reserved'),
              quantity: b.quantity !== undefined ? Number(b.quantity) : (b.availableCount ?? b.count ?? (b.isAvailable !== false ? 1 : 0)),
              availableCount: b.quantity !== undefined ? Number(b.quantity) : (b.availableCount ?? b.count ?? (b.isAvailable !== false ? 1 : 0)),
              isAvailable: b.isAvailable !== false && (b.quantity !== undefined ? Number(b.quantity) : (b.availableCount ?? b.count ?? 1)) > 0 && b.availabilityStatus !== 'UNAVAILABLE' && b.availabilityStatus !== 'Currently Unavailable',
              availabilityStatus: (b.isAvailable !== false && (b.quantity !== undefined ? Number(b.quantity) : (b.availableCount ?? b.count ?? 1)) > 0 && b.availabilityStatus !== 'UNAVAILABLE' && b.availabilityStatus !== 'Currently Unavailable') ? 'Available' : 'Currently Unavailable',
              rawBike: b,
              vehicleType: 'bike',
            };
          });
          const sorted = mapped.sort((a, b) => {
            if (a.isAvailable === b.isAvailable) return 0;
            return a.isAvailable ? -1 : 1;
          });
          setFleetBikes(sorted);
          setLoading(false);
        } else {
          setFleetBikes(FALLBACK_BIKES);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load bikes from DB:', err);
        setFleetBikes(FALLBACK_BIKES);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const categories = ['Available Now', 'All', 'Scooter', 'Commuter', 'Sports', 'Luxury'];

  const filteredBikes = useMemo(() => {
    let list = [];
    if (activeCategory === 'Available Now') {
      list = fleetBikes.filter((b) => b.isAvailable);
    } else if (activeCategory === 'All') {
      list = [...fleetBikes];
    } else {
      list = fleetBikes.filter((b) => b.category === activeCategory);
    }
    return list.sort((a, b) => {
      if (a.isAvailable === b.isAvailable) return 0;
      return a.isAvailable ? -1 : 1;
    });
  }, [activeCategory, fleetBikes]);

  return (
    <section className="py-16 sm:py-24">
      <Container>
        {/* BANNER */}
        <div className="mb-12 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-blue-950 to-slate-900 text-white border border-blue-500/30 shadow-[0_15px_45px_rgba(30,58,138,0.25)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-[11px] font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>ODISHA TWO-WHEELER FLEET • LIVE IN DATABASE</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Bhubaneswar Two-Wheeler Rental Fleet
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                Rent brand new scooties, commuter bikes, and high-performance cruisers directly from our live database with zero hidden charges.
              </p>
            </div>
            <WhatsAppButton
              message="Hello CARZODRIVE! 👋 I would like to inquire about Bike & Scooty rental bookings in Bhubaneswar."
              label="Inquire via WhatsApp"
              size="lg"
              variant="solid"
              className="shrink-0"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4 no-scrollbar mb-12">
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
              {cat}
            </button>
          ))}
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm font-bold text-slate-500">Loading bikes from database...</p>
          </div>
        ) : filteredBikes.length === 0 ? (
          <div className="py-16 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 p-8">
            <p className="text-slate-600 font-bold text-sm">No two-wheelers found in this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredBikes.map((bike) => (
                <motion.div
                  key={bike.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3 }}
                >
                  <BikeRideCard
                    bike={bike}
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
