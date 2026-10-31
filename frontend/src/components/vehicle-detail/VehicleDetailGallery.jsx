import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { DEFAULT_CAR_IMAGE, DEFAULT_BIKE_IMAGE, getOptimizedImageUrl, getVehicleDetailSrcSet } from '../../utils/documentUtils';

export const VehicleDetailGallery = ({ vehicle = {} }) => {
  const fallback = vehicle?.vehicleType === 'bike' ? DEFAULT_BIKE_IMAGE : DEFAULT_CAR_IMAGE;
  const rawImages = (Array.isArray(vehicle?.gallery) && vehicle.gallery.length > 0)
    ? vehicle.gallery
    : [vehicle?.image || fallback];
  const images = rawImages.filter(Boolean).length > 0 ? rawImages.filter(Boolean) : [fallback];

  const [activeImage, setActiveImage] = useState(images[0] || fallback);

  useEffect(() => {
    setActiveImage(images[0] || fallback);
  }, [vehicle]);

  return (
    <div className="space-y-4">
      {/* Main Image Display */}
      <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-3xl overflow-hidden bg-slate-900 border border-slate-200 shadow-md">
        <AnimatePresence mode="wait">
          <motion.img
            key={activeImage}
            src={getOptimizedImageUrl(activeImage, { width: 1600, quality: 'auto:best' })}
            srcSet={getVehicleDetailSrcSet(activeImage) || undefined}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 900px"
            alt={vehicle.name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            decoding="async"
            style={{ imageRendering: '-webkit-optimize-contrast', transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
            className="w-full h-full object-cover object-center"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = vehicle.vehicleType === 'bike' ? DEFAULT_BIKE_IMAGE : DEFAULT_CAR_IMAGE;
            }}
          />
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent pointer-events-none" />

        {/* Verification Badge */}
        <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-slate-200/90 text-slate-900 text-xs font-bold shadow-md">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>100% Inspected & Sanitized</span>
        </div>

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 right-4 px-3 py-1 rounded-full bg-white/95 backdrop-blur-md text-slate-900 text-xs font-bold border border-slate-200/90 shadow-xs">
            {images.indexOf(activeImage) + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnails Row */}
      {images.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveImage(img)}
              className={`relative w-24 h-16 rounded-2xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                activeImage === img
                  ? 'border-blue-600 ring-2 ring-blue-500/30 scale-105'
                  : 'border-slate-200 opacity-70 hover:opacity-100'
              }`}
            >
              <img
                src={getOptimizedImageUrl(img, { width: 240, height: 160, crop: 'fill', gravity: 'auto', quality: 'auto:good' })}
                alt={`${vehicle.name} view ${idx + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
