/**
 * Enterprise Production-Grade Document & KYC Media Resolver Utility
 * Handles Cloudinary assets, local uploads, PDF image rasterization, and secure cross-origin display
 */

const defaultApiUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
  ? 'https://carzodrive-1.onrender.com/api/v1'
  : 'http://localhost:5000/api/v1';

const rawApiUrl = (import.meta.env.VITE_API_URL || defaultApiUrl).trim().replace(/\/+$/, '');
const API_BASE_URL = rawApiUrl.endsWith('/api/v1')
  ? rawApiUrl
  : rawApiUrl.endsWith('/api')
  ? `${rawApiUrl}/v1`
  : `${rawApiUrl}/api/v1`;

// Base server origin (e.g., http://localhost:5000 or https://carzodrive-1.onrender.com)
export const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

export const DEFAULT_CAR_IMAGE = 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793001791/carzodrive/cars/car-main-1793001789245-86ca636d.jpg';
export const DEFAULT_BIKE_IMAGE = 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793262291/carzodrive/bikes/bike-main-1793262290712-a8c0708c.jpg';

export const DEFAULT_FLEET_CARS = [
  { id: 'creta-sx', slug: 'creta-sx', name: 'Hyundai Creta SX', brand: 'Hyundai', category: 'suv', type: 'SUV', color: 'Knight Black', pricePerDay: 2499, priceNumeric: 2499, seats: '5 Seats', seatsCount: 5, fuel: 'Petrol', fuelType: 'Petrol', transmission: 'Manual', quantity: 8, availableCount: 8, isAvailable: true, badge: 'Live in Hub', image: 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793001791/carzodrive/cars/car-main-1793001789245-86ca636d.jpg' },
  { id: 'swift-new', slug: 'swift-new', name: 'Maruti Suzuki Swift', brand: 'Maruti Suzuki', category: 'hatchback', type: 'Hatchback', color: 'Magma Grey', pricePerDay: 1499, priceNumeric: 1499, seats: '5 Seats', seatsCount: 5, fuel: 'Petrol', fuelType: 'Petrol', transmission: 'Manual', quantity: 5, availableCount: 5, isAvailable: true, badge: 'Live in Hub', image: 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793001974/carzodrive/cars/car-main-1793001972073-6c682a6c.jpg' },
  { id: 'thar-4x4', slug: 'thar-4x4', name: 'Mahindra Thar 4x4', brand: 'Mahindra', category: 'luxury', type: 'Luxury', color: 'Napoli Black', pricePerDay: 3299, priceNumeric: 3299, seats: '4 Seats', seatsCount: 4, fuel: 'Diesel', fuelType: 'Diesel', transmission: 'Manual', quantity: 6, availableCount: 6, isAvailable: true, badge: 'Live in Hub', image: 'https://res.cloudinary.com/gjjtie9o/image/upload/v1792772183/carzodrive/cars/car-main-1792772159781-4249df0c.jpg' },
  { id: 'kia-sonet', slug: 'kia-sonet', name: 'Kia Sonet HTX', brand: 'Kia', category: 'suv', type: 'SUV', color: 'Glacier White', pricePerDay: 1899, priceNumeric: 1899, seats: '5 Seats', seatsCount: 5, fuel: 'Petrol', fuelType: 'Petrol', transmission: 'Manual', quantity: 8, availableCount: 8, isAvailable: true, badge: 'Live in Hub', image: 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793001904/carzodrive/cars/car-main-1793001901616-cda93cca.jpg' },
  { id: 'tata-punch', slug: 'tata-punch', name: 'Tata Punch Creative', brand: 'Tata', category: 'suv', type: 'SUV', color: 'Tropical Mist', pricePerDay: 1599, priceNumeric: 1599, seats: '5 Seats', seatsCount: 5, fuel: 'Petrol', fuelType: 'Petrol', transmission: 'Manual', quantity: 8, availableCount: 8, isAvailable: true, badge: 'Live in Hub', image: 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793001842/carzodrive/cars/car-main-1793001834294-0ebc139b.jpg' },
  { id: 'fortuner-suv', slug: 'fortuner-suv', name: 'Toyota Fortuner 4x2', brand: 'Toyota', category: 'luxury', type: 'Luxury', color: 'Super White', pricePerDay: 4499, priceNumeric: 4499, seats: '7 Seats', seatsCount: 7, fuel: 'Diesel', fuelType: 'Diesel', transmission: 'Automatic', quantity: 4, availableCount: 4, isAvailable: true, badge: 'Live in Hub', image: 'https://res.cloudinary.com/gjjtie9o/image/upload/v1792779598/carzodrive/cars/car-main-1792779591435-ee911a8b.jpg' },
];

export const DEFAULT_FLEET_BIKES = [
  { id: 'hero-splendor-plus', slug: 'hero-splendor-plus', name: 'Hero Splendor Plus XTEC', brand: 'Hero', category: 'commuter', type: 'Two Wheeler', color: 'Black & Blue', pricePerDay: 499, priceNumeric: 499, seats: '2 Seats', fuel: 'Petrol', fuelType: 'Petrol', transmission: 'Manual', isAvailable: true, availableCount: 20, quantity: 20, badge: 'Two Wheeler', image: 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793262291/carzodrive/bikes/bike-main-1793262290712-a8c0708c.jpg' },
  { id: 'honda-activa-6g', slug: 'honda-activa-6g', name: 'Honda Activa 6G Scooty', brand: 'Honda', category: 'scooter', type: 'Two Wheeler', color: 'Pearl White', pricePerDay: 549, priceNumeric: 549, seats: '2 Seats', fuel: 'Petrol', fuelType: 'Petrol', transmission: 'Automatic', isAvailable: true, availableCount: 15, quantity: 15, badge: 'Two Wheeler', image: 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793262145/carzodrive/bikes/bike-main-1793262144481-2bbb612b.jpg' },
];

/**
 * Contextual fallback image based on vehicle brand/model using real Cloudinary fleet assets
 */
export function getVehicleFallbackImage(vehicleOrName, defaultFallback = DEFAULT_CAR_IMAGE) {
  const name = typeof vehicleOrName === 'string' ? vehicleOrName.toLowerCase() : (vehicleOrName?.name || '').toLowerCase();
  if (name.includes('creta') || name.includes('hyundai')) {
    return 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793001791/carzodrive/cars/car-main-1793001789245-86ca636d.jpg';
  }
  if (name.includes('sonet') || name.includes('seltos') || name.includes('kia')) {
    return 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793001904/carzodrive/cars/car-main-1793001901616-cda93cca.jpg';
  }
  if (name.includes('fortuner') || name.includes('toyota')) {
    return 'https://res.cloudinary.com/gjjtie9o/image/upload/v1792779598/carzodrive/cars/car-main-1792779591435-ee911a8b.jpg';
  }
  if (name.includes('scorpio') || name.includes('mahindra') || name.includes('thar')) {
    return 'https://res.cloudinary.com/gjjtie9o/image/upload/v1792772183/carzodrive/cars/car-main-1792772159781-4249df0c.jpg';
  }
  if (name.includes('punch') || name.includes('tata')) {
    return 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793001842/carzodrive/cars/car-main-1793001834294-0ebc139b.jpg';
  }
  if (name.includes('swift') || name.includes('maruti')) {
    return 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793001974/carzodrive/cars/car-main-1793001972073-6c682a6c.jpg';
  }
  if (name.includes('splendor') || name.includes('hero')) {
    return DEFAULT_BIKE_IMAGE;
  }
  if (name.includes('activa') || name.includes('honda') || name.includes('scooty') || name.includes('bike')) {
    return 'https://res.cloudinary.com/gjjtie9o/image/upload/v1793262145/carzodrive/bikes/bike-main-1793262144481-2bbb612b.jpg';
  }
  return defaultFallback;
}

/**
 * Universal resolver for car, bike, and package vehicle images.
 * Handles Cloudinary CDN URLs, local /uploads paths from backend, and high-res defaults.
 * Supports optional Cloudinary optimization parameters.
 */
export function resolveVehicleImageUrl(url, fallback = DEFAULT_CAR_IMAGE, options = null) {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;

  let resolved = trimmed;
  if (trimmed.startsWith('/uploads') || trimmed.startsWith('uploads/')) {
    const clean = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    resolved = `${SERVER_ORIGIN}${clean}`;
  }

  if (options && resolved.includes('cloudinary.com') && resolved.includes('/image/upload/')) {
    return getOptimizedImageUrl(resolved, options);
  }

  return resolved;
}

/**
 * Generates an optimized, high-fidelity Cloudinary CDN image URL.
 * Preserves master image clarity via server-side bicubic/Lanczos resampling,
 * automated modern format negotiation (AVIF/WebP), and optimal density scaling.
 * 
 * Non-Cloudinary URLs are safely returned unchanged.
 */
export function getOptimizedImageUrl(url, options = {}) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  if (!trimmed.includes('cloudinary.com') || !trimmed.includes('/image/upload/')) {
    return trimmed;
  }

  const {
    width = 900,
    height = null,
    quality = 'auto:best',
    format = 'auto',
    crop = 'fill',
    gravity = 'auto',
    dpr = null,
  } = options;

  const parts = [];
  if (crop) parts.push(`c_${crop}`);
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (gravity && crop === 'fill') parts.push(`g_${gravity}`);
  if (quality) parts.push(`q_${quality}`);
  if (format) parts.push(`f_${format}`);
  if (dpr) parts.push(`dpr_${dpr}`);

  const transformStr = parts.join(',');

  const uploadIndex = trimmed.indexOf('/image/upload/');
  if (uploadIndex === -1) return trimmed;

  const prefix = trimmed.substring(0, uploadIndex + '/image/upload/'.length);
  const suffix = trimmed.substring(uploadIndex + '/image/upload/'.length);

  // Strip existing transformation segment if present (e.g. c_thumb,w_200/)
  const cleanSuffix = suffix.replace(/^(?:[a-z]_[a-z0-9_:,.-]+\/)+/i, '');

  return `${prefix}${transformStr}/${cleanSuffix}`;
}

/**
 * Generates a responsive srcset for card components (480w, 800w, 1200w)
 * matching 1x, 2x Retina, and 4K display pixel densities with zero blur.
 */
export function getVehicleCardSrcSet(url, baseWidth = 800, aspectRatio = 16 / 10) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com') || !url.includes('/image/upload/')) {
    return null;
  }

  const w1 = 480;
  const h1 = Math.round(w1 / aspectRatio);
  const w2 = 800;
  const h2 = Math.round(w2 / aspectRatio);
  const w3 = 1200;
  const h3 = Math.round(w3 / aspectRatio);

  const u1 = getOptimizedImageUrl(url, { width: w1, height: h1, crop: 'fill', gravity: 'auto', quality: 'auto:good' });
  const u2 = getOptimizedImageUrl(url, { width: w2, height: h2, crop: 'fill', gravity: 'auto', quality: 'auto:best' });
  const u3 = getOptimizedImageUrl(url, { width: w3, height: h3, crop: 'fill', gravity: 'auto', quality: 'auto:best' });

  return `${u1} 480w, ${u2} 800w, ${u3} 1200w`;
}

/**
 * Generates responsive srcset for large hero & vehicle details gallery (800w, 1200w, 1600w, 2000w).
 */
export function getVehicleDetailSrcSet(url, aspectRatio = 16 / 9) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com') || !url.includes('/image/upload/')) {
    return null;
  }

  const w1 = 800;
  const h1 = Math.round(w1 / aspectRatio);
  const w2 = 1200;
  const h2 = Math.round(w2 / aspectRatio);
  const w3 = 1600;
  const h3 = Math.round(w3 / aspectRatio);
  const w4 = 2000;
  const h4 = Math.round(w4 / aspectRatio);

  const u1 = getOptimizedImageUrl(url, { width: w1, height: h1, crop: 'fill', gravity: 'auto', quality: 'auto:good' });
  const u2 = getOptimizedImageUrl(url, { width: w2, height: h2, crop: 'fill', gravity: 'auto', quality: 'auto:best' });
  const u3 = getOptimizedImageUrl(url, { width: w3, height: h3, crop: 'fill', gravity: 'auto', quality: 'auto:best' });
  const u4 = getOptimizedImageUrl(url, { width: w4, height: h4, crop: 'fill', gravity: 'auto', quality: 'auto:best' });

  return `${u1} 800w, ${u2} 1200w, ${u3} 1600w, ${u4} 2000w`;
}

/**
 * Extracts clean filename from any local or remote URL
 */
export function extractDocumentFilename(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const cleanUrl = url.split('?')[0];
    const parts = cleanUrl.split('/');
    return parts[parts.length - 1] || '';
  } catch {
    return '';
  }
}

/**
 * Checks if the URL represents a PDF document.
 */
export function isPdfUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.split('?')[0].toLowerCase();
  return clean.endsWith('.pdf') || url.toLowerCase().includes('.pdf');
}

/**
 * Checks if the URL represents an image document.
 */
export function isImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:image/')) return true;
  const clean = url.split('?')[0].toLowerCase();
  return /\.(jpg|jpeg|png|webp|avif|gif)$/i.test(clean) || (url.includes('/image/upload/') && !isPdfUrl(url));
}

/**
 * Resolves a raw URL to a guaranteed fully qualified URL accessible by the browser.
 * For Cloudinary PDF files (which Cloudinary blocks with 401 ACL deny),
 * it seamlessly routes to the backend delivery endpoint (http://localhost:5000/uploads/... or /api/v1/uploads/document/...)
 * which serves the full original PDF with 200 OK and inline disposition!
 */
export function resolveDocumentUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Local object URLs or base64 data URLs
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Relative backend uploads path (e.g. /uploads/drivingLicense-123.pdf)
  if (trimmed.startsWith('/uploads')) {
    return `${SERVER_ORIGIN}${trimmed}`;
  }

  if (trimmed.startsWith('uploads/')) {
    return `${SERVER_ORIGIN}/${trimmed}`;
  }

  // If it's a Cloudinary PDF document, bypass Cloudinary's 401 ACL block by routing to the backend endpoint
  if (trimmed.includes('cloudinary.com') && isPdfUrl(trimmed)) {
    const filename = extractDocumentFilename(trimmed);
    if (filename) {
      return `${SERVER_ORIGIN}/uploads/${filename}?url=${encodeURIComponent(trimmed)}`;
    }
  }

  // Full external URL (Cloudinary images, AWS S3, etc.)
  return trimmed;
}

/**
 * Gets an image-renderable preview URL for any document.
 * Cloudinary default security restricts raw .pdf delivery (401 ACL deny),
 * but instantly renders high-definition rasterized images of the PDF when requested with .png or .jpg!
 */
export function getDocumentPreviewUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();

  // If Cloudinary PDF, convert delivery extension to .png to fetch rendered page preview directly from Cloudinary
  if (trimmed.includes('cloudinary.com') && isPdfUrl(trimmed)) {
    return trimmed.replace(/\.pdf(\?.*)?$/i, '.png$1');
  }

  const resolved = resolveDocumentUrl(trimmed);

  // If local PDF, request preview from backend
  if (isPdfUrl(resolved)) {
    const filename = extractDocumentFilename(resolved);
    if (filename) {
      return `${API_BASE_URL}/uploads/document/${filename}?preview=1`;
    }
  }

  return resolved;
}

/**
 * Helper to download a document safely using direct stream attachment headers
 */
export async function downloadDocument(url, filename = 'document') {
  if (!url) return;
  const resolved = resolveDocumentUrl(url);
  const isPdf = isPdfUrl(url) || isPdfUrl(resolved);
  const ext = isPdf ? '.pdf' : '.jpg';
  const downloadName = filename.toLowerCase().endsWith(ext) ? filename : `${filename}${ext}`;

  // If we can extract the filename, use backend download endpoint directly
  const docFilename = extractDocumentFilename(resolved);
  if (docFilename) {
    const downloadEndpoint = `${API_BASE_URL}/uploads/document/${docFilename}?download=1&name=${encodeURIComponent(downloadName)}`;
    const link = document.createElement('a');
    link.href = downloadEndpoint;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  // Fallback: fetch blob
  try {
    const res = await fetch(resolved, { mode: 'cors' });
    if (!res.ok) throw new Error('Download request rejected');
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch {
    window.open(resolved, '_blank', 'noopener,noreferrer');
  }
}
