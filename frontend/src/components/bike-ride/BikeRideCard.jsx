import React from 'react';
import { Link } from 'react-router-dom';
import { Gauge, Fuel, Bike } from 'lucide-react';
import { WhatsAppButton } from '../common/WhatsAppButton';
import { getVehicleWhatsAppMessage } from '../../utils/whatsapp';
import { useAuth } from '../../hooks/useAuth';

export const BikeRideCard = ({ bike, onOpenQuickBook }) => {
  const { isAuthenticated, openAuthModal } = useAuth();
  const detailTarget = `/bike/${bike.id}`;
  const count = bike.quantity !== undefined ? Number(bike.quantity) : (bike.availableCount ?? bike.count ?? (bike.isAvailable !== false ? 1 : 0));
  const isAvailable = bike.isAvailable !== false && count > 0 && bike.availabilityStatus !== 'UNAVAILABLE' && bike.availabilityStatus !== 'Currently Unavailable';

  return (
    <div className="group rounded-3xl bg-white border border-slate-200/80 hover:border-blue-500/50 transition-all duration-500 shadow-card hover:shadow-card-hover overflow-hidden flex flex-col justify-between">
      {/* Bike Image Header */}
      <Link
        to={detailTarget}
        onClick={(e) => {
          if (!isAuthenticated) {
            e.preventDefault();
            openAuthModal('login');
          }
        }}
        className="relative aspect-[16/10] overflow-hidden bg-slate-100 block"
      >
        <img
          src={bike.image}
          srcSet={bike.imageSrcSet || undefined}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          alt={bike.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out will-change-transform"
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

        <div className="absolute top-3 left-3">
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/90 text-slate-900 shadow-xs">
            {bike.badge}
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
            {bike.pricePerDay}
          </span>
          <span className="text-xs text-slate-300 ml-1">/ day</span>
        </div>
      </Link>

      {/* Content Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
            {bike.category}
          </span>
          <h3 className="text-base font-black text-slate-950 mt-0.5 group-hover:text-blue-600 transition-colors">
            {bike.name}
          </h3>
        </div>

        {/* Specs Tags */}
        <div className="grid grid-cols-2 gap-2 py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-600">
          <div className="flex items-center gap-1.5 truncate">
            <Gauge className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{bike.engine}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <Fuel className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{bike.mileage}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>Refundable Deposit:</span>
          <span className="font-bold text-slate-900">{bike.deposit}</span>
        </div>

        {/* Hub Stock Row */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>Hub Available Stock:</span>
          {isAvailable ? (
            <span className="font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {count} Units Available
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
            message={getVehicleWhatsAppMessage(bike)}
            variant="icon-only"
            size="md"
          />

          {isAvailable ? (
            <button
              type="button"
              onClick={() =>
                onOpenQuickBook?.({
                  vehicle: bike,
                  type: 'bike',
                  bikeId: bike.rawId || bike.id,
                  _id: bike.rawId || bike.id,
                })
              }
              className="flex-1 py-3 px-2 rounded-xl font-black text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 transition-all shadow-md cursor-pointer text-center flex items-center justify-center gap-1"
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Book</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="flex-1 py-3 px-2 rounded-xl font-black text-xs text-rose-500 bg-rose-50 border border-rose-200 cursor-not-allowed select-none text-center"
              title="This bike has 0 units available and is currently unavailable"
            >
              Currently Unavailable
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
