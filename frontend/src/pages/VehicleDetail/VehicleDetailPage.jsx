import React, { useState, useEffect } from 'react';
import { useParams, useOutletContext, Link } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Container } from '../../components/common/Container';
import { vehiclesAPI, bikesAPI } from '../../services/api';
import { resolveVehicleImageUrl, DEFAULT_CAR_IMAGE, DEFAULT_BIKE_IMAGE, DEFAULT_FLEET_CARS, DEFAULT_FLEET_BIKES } from '../../utils/documentUtils';
import { VehicleDetailHero } from '../../components/vehicle-detail/VehicleDetailHero';
import { VehicleDetailGallery } from '../../components/vehicle-detail/VehicleDetailGallery';
import { VehicleDetailSpecs } from '../../components/vehicle-detail/VehicleDetailSpecs';
import { VehicleDetailFeatures } from '../../components/vehicle-detail/VehicleDetailFeatures';
import { VehicleDetailBookingBox } from '../../components/vehicle-detail/VehicleDetailBookingBox';
import { VehicleDetailSimilar } from '../../components/vehicle-detail/VehicleDetailSimilar';

export const VehicleDetailPage = () => {
  const { id } = useParams();
  const { handleOpenQuickBook } = useOutletContext() || {};

  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    async function fetchVehicle() {
      try {
        // 1. Try fetching car from database by ID or Slug
        let res = null;
        let isBike = false;
        try {
          res = await vehiclesAPI.getBySlugOrId(id);
        } catch {
          // If not a car, check bikes
          try {
            res = await bikesAPI.getBySlugOrId(id);
            isBike = true;
          } catch {
            // Not found in bikes
          }
        }

        if (res?.data && isMounted) {
          const raw = res.data;
          const fallbackImg = isBike ? DEFAULT_BIKE_IMAGE : DEFAULT_CAR_IMAGE;
          const rawImg = (raw.images && raw.images[0]) || raw.image || fallbackImg;
          const primaryImage = resolveVehicleImageUrl(rawImg, fallbackImg);
          const allImages = (raw.images && raw.images.length > 0)
            ? raw.images.map((img) => resolveVehicleImageUrl(img, fallbackImg))
            : [primaryImage];
          const price = raw.pricing?.dailyRate || raw.pricePerDay || (isBike ? 499 : 1499);

          const normalized = {
            id: raw.slug || raw._id || raw.id,
            _id: raw._id || raw.id,
            vehicleId: raw._id || raw.id,
            name: raw.name,
            brand: raw.brand || 'Premium',
            model: raw.model || raw.name,
            category: raw.category || (isBike ? 'Bike' : 'Sedan'),
            vehicleType: isBike ? 'bike' : 'car',
            color: raw.color || 'Standard',
            year: raw.year || 2024,
            image: primaryImage,
            images: allImages,
            pricePerDay: price,
            priceDisplay: `₹${price.toLocaleString('en-IN')}`,
            badge: raw.badge || ((raw.isAvailable !== false && (raw.quantity !== undefined ? Number(raw.quantity) : (raw.availableCount ?? 1)) > 0) ? 'Verified' : 'Reserved'),
            isAvailable: raw.isAvailable !== false && (raw.quantity !== undefined ? Number(raw.quantity) : (raw.availableCount ?? 1)) > 0 && raw.availabilityStatus !== 'UNAVAILABLE' && raw.availabilityStatus !== 'Currently Unavailable',
            quantity: raw.quantity !== undefined ? Number(raw.quantity) : (raw.availableCount ?? (raw.isAvailable !== false ? 1 : 0)),
            availableCount: raw.quantity !== undefined ? Number(raw.quantity) : (raw.availableCount ?? (raw.isAvailable !== false ? 1 : 0)),
            availabilityStatus: (raw.isAvailable !== false && (raw.quantity !== undefined ? Number(raw.quantity) : (raw.availableCount ?? 1)) > 0 && raw.availabilityStatus !== 'UNAVAILABLE' && raw.availabilityStatus !== 'Currently Unavailable') ? 'Available' : 'Currently Unavailable',
            rating: raw.rating?.average || 4.9,
            reviewsCount: raw.rating?.count || 48,
            pricing: raw.pricing || {
              dailyRate: price,
              dailyRateWithFuel: price + 600,
              securityDeposit: isBike ? 1000 : 2000,
              extraKmCharge: isBike ? 4 : 10,
              extraHourCharge: isBike ? 50 : 150,
            },
            engineCC:
              raw.engineCC ||
              (raw.engineCapacity ? parseInt(String(raw.engineCapacity).replace(/[^0-9]/g, ''), 10) : null) ||
              (raw.specs?.engine ? parseInt(String(raw.specs.engine).replace(/[^0-9]/g, ''), 10) : null) ||
              (isBike ? 350 : null),
            engineCapacity:
              raw.engineCapacity ||
              (raw.engineCC ? `${raw.engineCC} cc` : null) ||
              raw.specs?.engine ||
              (isBike ? '350 cc' : '1197 cc'),
            power: raw.power || raw.specs?.power || (isBike ? '20.2 HP' : '115 HP'),
            topSpeed: raw.topSpeed || raw.specs?.topSpeed || (isBike ? '120 km/h' : '175 km/h'),
            transmission: raw.transmission || raw.specs?.transmission || (isBike ? '5-Speed Manual' : 'Manual / Auto'),
            specs: {
              seats: isBike ? '2 Seats' : `${raw.seats || 5} Seats`,
              fuelType: raw.fuelType ? raw.fuelType.toUpperCase() : 'PETROL',
              transmission: raw.transmission ? raw.transmission.toUpperCase() : (isBike ? '5-SPEED MANUAL' : 'MANUAL'),
              engine: isBike
                ? (raw.engineCC
                    ? `${raw.engineCC} cc`
                    : raw.engineCapacity
                    ? (String(raw.engineCapacity).includes('cc') ? raw.engineCapacity : `${raw.engineCapacity} cc`)
                    : raw.specs?.engine || '350 cc')
                : (raw.engineCapacity
                    ? (String(raw.engineCapacity).includes('cc') ? raw.engineCapacity : `${raw.engineCapacity} cc`)
                    : raw.specs?.engine || '1197 cc'),
              mileage: raw.mileage ? (String(raw.mileage).includes('km') ? raw.mileage : `${raw.mileage} km/l`) : (isBike ? '45 km/l' : '20 km/l'),
              power: raw.power || raw.specs?.power || (isBike ? '20.2 HP' : '115 HP'),
              topSpeed: raw.topSpeed || raw.specs?.topSpeed || (isBike ? '120 km/h' : '175 km/h'),
              brakes: raw.brakes || raw.specs?.brakes || (isBike ? 'Dual-Channel ABS' : 'Disc + ABS'),
              bootSpace: isBike ? 'N/A' : (raw.specs?.bootSpace || '268 Litres'),
              airbags: isBike ? 'N/A' : (raw.specs?.airbags || '6 Airbags (Dual Front + Side)'),
              groundClearance: isBike ? (raw.specs?.groundClearance || '165 mm') : (raw.specs?.groundClearance || '170 mm'),
            },
            features: raw.features?.length
              ? raw.features
              : [
                  'Full Air Conditioning',
                  'Touchscreen Infotainment & Bluetooth',
                  'Keyless Push Button Start',
                  'Reverse Parking Camera & Sensors',
                  'Comprehensive Zero-Dep Insurance Included',
                  '24x7 Roadside Assistance across Odisha',
                ],
            rawVehicle: raw,
          };

          setVehicle(normalized);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('API lookup error for vehicle:', err);
      }

      if (isMounted) {
        const fallbackMatch =
          DEFAULT_FLEET_CARS.find((c) => c.id === id || c.slug === id) ||
          DEFAULT_FLEET_BIKES.find((b) => b.id === id || b.slug === id);

        if (fallbackMatch) {
          const isBike = fallbackMatch.vehicleType === 'bike' || fallbackMatch.category === 'commuter' || fallbackMatch.category === 'scooter';
          const price = fallbackMatch.priceNumeric || fallbackMatch.pricePerDay || (isBike ? 499 : 1499);
          const fallbackNorm = {
            id: fallbackMatch.slug || fallbackMatch.id,
            _id: fallbackMatch.id,
            vehicleId: fallbackMatch.id,
            name: fallbackMatch.name,
            brand: fallbackMatch.brand || 'Premium',
            model: fallbackMatch.name,
            category: fallbackMatch.category || (isBike ? 'Bike' : 'Sedan'),
            vehicleType: isBike ? 'bike' : 'car',
            color: fallbackMatch.color || 'Standard',
            year: 2024,
            image: fallbackMatch.image,
            images: [fallbackMatch.image],
            pricePerDay: price,
            priceDisplay: `₹${price.toLocaleString('en-IN')}`,
            badge: fallbackMatch.badge || 'Live Fleet',
            isAvailable: true,
            quantity: fallbackMatch.quantity || 5,
            availableCount: fallbackMatch.availableCount || 5,
            availabilityStatus: 'Available',
            rating: 4.95,
            reviewsCount: 64,
            pricing: {
              dailyRate: price,
              dailyRateWithFuel: price + 600,
              securityDeposit: isBike ? 1000 : 2000,
              extraKmCharge: isBike ? 4 : 10,
              extraHourCharge: isBike ? 50 : 150,
            },
            specs: {
              seats: fallbackMatch.seats || (isBike ? '2 Seats' : '5 Seats'),
              fuelType: fallbackMatch.fuelType || 'PETROL',
              transmission: fallbackMatch.transmission || 'MANUAL',
              engine: isBike ? '350 cc' : '1197 cc',
              mileage: isBike ? '45 km/l' : '20 km/l',
              power: isBike ? '20.2 HP' : '115 HP',
              topSpeed: isBike ? '120 km/h' : '175 km/h',
              brakes: isBike ? 'Dual-Channel ABS' : 'Disc + ABS',
              bootSpace: isBike ? 'N/A' : '391 Litres',
              airbags: isBike ? 'N/A' : '6 Airbags (Dual Front + Side)',
              groundClearance: isBike ? '165 mm' : '190 mm',
            },
            features: [
              'Full Air Conditioning',
              'Touchscreen Infotainment & Bluetooth',
              'Keyless Push Button Start',
              'Reverse Parking Camera & Sensors',
              'Comprehensive Zero-Dep Insurance Included',
              '24x7 Roadside Assistance across Odisha',
            ],
            rawVehicle: fallbackMatch,
          };
          setVehicle(fallbackNorm);
          setLoading(false);
          return;
        }

        setVehicle(null);
        setLoading(false);
      }
    }

    fetchVehicle();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="pt-32 pb-20 bg-white min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-sm font-bold text-slate-500">Loading vehicle details from database...</p>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="pt-32 pb-20 bg-white min-h-[60vh] text-center">
        <Container className="space-y-4">
          <h2 className="text-2xl font-black text-slate-900">Vehicle Not Found</h2>
          <p className="text-sm text-slate-500">The vehicle you are looking for is not listed in our database.</p>
          <Link
            to="/car-self-ride"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Cars</span>
          </Link>
        </Container>
      </div>
    );
  }

  return (
    <div className="pt-24 sm:pt-28 pb-20 bg-white text-slate-900 min-h-screen">
      <Container className="space-y-10">
        {/* 1. HERO HEADER WITH BREADCRUMB, TITLE, REVIEWS & WHATSAPP ACTION */}
        <VehicleDetailHero vehicle={vehicle} />

        {/* 2. TWO-COLUMN INTERACTIVE DETAIL LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* LEFT COLUMN: Gallery, Specs, Features, Policies */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-10">
            <VehicleDetailGallery vehicle={vehicle} />
            <VehicleDetailSpecs vehicle={vehicle} />
            <VehicleDetailFeatures vehicle={vehicle} />
          </div>

          {/* RIGHT COLUMN: Sticky Pricing Box & Actions */}
          <div className="lg:col-span-5 xl:col-span-4">
            <VehicleDetailBookingBox
              vehicle={vehicle}
              onOpenQuickBook={handleOpenQuickBook}
            />
          </div>
        </div>

        {/* 3. SIMILAR VEHICLES SECTION */}
        <VehicleDetailSimilar
          currentVehicle={vehicle}
          onOpenQuickBook={handleOpenQuickBook}
        />
      </Container>
    </div>
  );
};
