import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, ChevronDown, Check, X, Sparkles, Navigation } from 'lucide-react';
import { BHUBANESWAR_LOCATIONS } from '../../config/bookingConfig';

/**
 * Enterprise Production-Grade Searchable Location Input with Autocomplete & Custom Typing
 * Allows users to either:
 * 1. Manually type any custom doorstep address, landmark, hotel, or city.
 * 2. Click from popular Bhubaneswar hubs and landmarks with 1-click selection.
 */
export const SearchableLocationInput = ({
  value = '',
  onChange,
  options = BHUBANESWAR_LOCATIONS,
  placeholder = 'Type address or choose landmark...',
  label,
  icon: Icon = MapPin,
  allowCustom = true,
  includeSameAsPickup = false,
  pickupLocationValue = '',
  className = '',
  id = 'location-input',
  autoSelectOnBlur = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Filter options based on user typing
  const filteredOptions = useMemo(() => {
    if (!value || typeof value !== 'string') return options;
    const clean = value.toLowerCase().trim();
    if (!clean) return options;
    return options.filter((loc) => loc.toLowerCase().includes(clean));
  }, [value, options]);

  const handleSelect = (selectedLoc) => {
    onChange?.(selectedLoc);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.('');
    inputRef.current?.focus();
    setIsOpen(true);
  };

  const isExactMatch = options.some(
    (loc) => loc.toLowerCase() === (value || '').toLowerCase().trim()
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-[10px] sm:text-[10.5px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between gap-1.5 mb-1"
        >
          <span className="flex items-center gap-1.5 truncate">
            <Icon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">{label}</span>
          </span>
          {allowCustom && (
            <span className="text-[8.5px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded-full shrink-0">
              Type or Select
            </span>
          )}
        </label>
      )}

      {/* Input container */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange?.(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none py-1 sm:py-0.5 pr-14 min-h-[38px] sm:min-h-0"
        />

        {/* Clear and Toggle Buttons */}
        <div className="absolute right-0 flex items-center gap-0.5 text-slate-400">
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
              title="Clear location"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            className="p-1 hover:text-blue-600 rounded-full transition-colors cursor-pointer"
            title="Show options"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu / Suggestions Popover */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-[0_12px_35px_rgba(15,23,42,0.18)] overflow-hidden max-h-64 sm:max-h-72 overflow-y-auto backdrop-blur-md">
          {/* Header pill */}
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Popular Landmarks & Hubs</span>
            {value && !isExactMatch && allowCustom && (
              <span className="text-blue-600 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Custom Address
              </span>
            )}
          </div>

          <div className="p-1 space-y-0.5">
            {/* Same as Pick-up option if requested */}
            {includeSameAsPickup && (
              <button
                type="button"
                onClick={() => handleSelect(pickupLocationValue || 'Same as Pick-up Location')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                  value === (pickupLocationValue || 'Same as Pick-up Location')
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-800 hover:bg-slate-50 hover:text-blue-600'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Navigation className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">Same as Pick-up Location</span>
                </span>
                {value === (pickupLocationValue || 'Same as Pick-up Location') && (
                  <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                )}
              </button>
            )}

            {/* Custom typed value quick select option */}
            {allowCustom && value && value.trim().length > 1 && !isExactMatch && (
              <button
                type="button"
                onClick={() => handleSelect(value.trim())}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold bg-blue-50/70 text-blue-700 hover:bg-blue-100 transition-all flex items-center justify-between gap-2 cursor-pointer border border-blue-200/60"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                  <span className="truncate">
                    Use custom: &ldquo;<span className="underline">{value.trim()}</span>&rdquo;
                  </span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600 text-white font-extrabold uppercase shrink-0">
                  Select
                </span>
              </button>
            )}

            {/* Filtered list of Bhubaneswar Landmarks */}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((loc) => {
                const isSelected = (value || '').toLowerCase().trim() === loc.toLowerCase().trim();
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => handleSelect(loc)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-950'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-slate-400 shrink-0">📍</span>
                      <span className="truncate">{loc}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-3 text-center text-xs text-slate-500">
                <p className="font-semibold text-slate-700">No landmark matches &ldquo;{value}&rdquo;</p>
                {allowCustom && (
                  <p className="text-[11px] text-blue-600 mt-1 font-bold">
                    Press Enter or click custom address above to use &ldquo;{value}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

