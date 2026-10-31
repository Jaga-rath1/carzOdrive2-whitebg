import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Fuel, Gauge } from 'lucide-react';
import { WhatsAppButton } from '../common/WhatsAppButton';
import { getVehicleWhatsAppMessage } from '../../utils/whatsapp';
import { getVehicleFallbackImage } from '../../utils/documentUtils';
import { useAuth } from '../../hooks/useAuth';

export const CarRideCard = ({ vehicle, onOpenQuickBook }) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const detailTarget = `/vehicle/${vehicle.id}`;
  const count = vehicle.quantity !== undefined ? Number(vehicle.quantity) : (vehicle.availableCount ?? vehicle.count ?? (vehicle.isAvailable !== false ? 1 : 0));
  const isAvailable = vehicle.isAvailable !== false && count > 0 && vehicle.availabilityStatus !== 'UNAVAILABLE' && vehicle.availabilityStatus !== 'Currently Unavailable';

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-3xl bg-white border shadow-[0_6px_25px_rgba(0,0,0,0.06)] transition-all duration-300 overflow-hidden ${
        isAvailable
          ? 'border-slate-200/90 hover:shadow-[0_16px_40px_rgba(37,99,235,0.16)] hover:border-blue-500'
          : 'border-slate-200/80 hover:border-slate-300'
      }`}
    >
      {/* Car Image Header */}
      <Link
        to={detailTarget}
        onClick={(e) => {
          if (!isAuthenticated) {
            e.preventDefault();
            openAuthModal('login');
          }
        }}
        className="relative h-60 w-full overflow-hidden bg-slate-100 block"
      >
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

        <div className="absolute top-3 left-3">
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/90 text-slate-900 shadow-xs">
            {vehicle.badge}
          </span>
        </div>

        <div className="absolute top-3 right-3">
          {isAvailable ? (
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-sm backdrop-blur-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>{count} Available</span>
            </span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-600 text-white shadow-sm backdrop-blur-sm">
              Currently Unavailable
            </span>
          )}
        </div>

        <div className="absolute bottom-3 right-3 text-right">
          <span className="text-xl font-black text-white drop-shadow-md">
            {vehicle.priceDisplay}
          </span>
          <span className="text-xs text-slate-300 ml-1">/ day</span>
        </div>
      </Link>

      {/* Body Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              {vehicle.category}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">
              {vehicle.color} • {vehicle.year}
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-950 mt-1 group-hover:text-blue-600 transition-colors">
            {vehicle.name}
          </h3>
        </div>

        {/* Specs Row */}
        <div className="grid grid-cols-3 gap-1.5 py-2.5 px-3 rounded-2xl bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-600">
          <div className="flex items-center gap-1 truncate">
            <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{vehicle.seats} Seats</span>
          </div>
          <div className="flex items-center gap-1 truncate">
            <Fuel className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{vehicle.fuel}</span>
          </div>
          <div className="flex items-center gap-1 truncate">
            <Gauge className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{vehicle.transmission}</span>
          </div>
        </div>

        {/* Inventory Stock Row */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
          <span className="text-slate-500 font-medium">Hub Available Stock:</span>
          {isAvailable ? (
            <span className="font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {count} Units
            </span>
          ) : (
            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              Currently Unavailable (0)
            </span>
          )}
        </div>


        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Link
            to={detailTarget}
            onClick={(e) => {
              if (!isAuthenticated) {
                e.preventDefault();
                openAuthModal('login');
              }
            }}
            className="flex-1 py-3 px-2 rounded-xl border border-slate-200 hover:border-blue-500 font-bold text-xs text-slate-700 hover:text-blue-600 transition-all cursor-pointer text-center bg-slate-50 hover:bg-white"
          >
            View Details
          </Link>

          <WhatsAppButton
            message={getVehicleWhatsAppMessage(vehicle)}
            variant="icon-only"
            size="md"
          />

          {isAvailable ? (
            <button
              type="button"
              onClick={() =>
                onOpenQuickBook?.({
                  ...vehicle,
                  vehicleId: vehicle.rawId || vehicle.id,
                  _id: vehicle.rawId || vehicle.id,
                })
              }
              className="flex-1 py-3 px-2 rounded-xl font-black text-xs text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md cursor-pointer text-center"
            >
              Book Now
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="flex-1 py-3 px-2 rounded-xl font-black text-xs text-rose-500 bg-rose-50 border border-rose-200 cursor-not-allowed select-none text-center"
              title="This car has 0 units available and is currently unavailable"
            >
              Currently Unavailable
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
