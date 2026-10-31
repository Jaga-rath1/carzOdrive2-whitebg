/**
 * CarzoDrive Frontend API Client
 * Seamlessly connects React UI to the CarzoDrive Backend (http://localhost:5000/api/v1)
 */

const getInitialApiBaseUrl = () => {
  const isBrowser = typeof window !== 'undefined';
  const isLocalHost = isBrowser && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '[::1]'
  );

  const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

  // If in browser and NOT on localhost (e.g. deployed on Vercel or accessed via remote host),
  // NEVER use localhost URL even if it was present in .env during build
  if (isBrowser && !isLocalHost && (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
    return 'https://carzodrive-1.onrender.com/api/v1';
  }

  // In local Vite dev mode, use /api/v1 (which Vite proxies to http://localhost:5000/api/v1)
  // This completely eliminates CORS issues, IPv6/IPv4 mismatch, and firewall port blocking
  if (isBrowser && isLocalHost && import.meta.env.DEV) {
    return '/api/v1';
  }

  const raw = envUrl || (isLocalHost ? 'http://localhost:5000/api/v1' : 'https://carzodrive-1.onrender.com/api/v1');
  return raw.endsWith('/api/v1')
    ? raw
    : raw.endsWith('/api')
    ? `${raw}/v1`
    : `${raw}/api/v1`;
};

export const API_BASE_URL = getInitialApiBaseUrl();

// Token helpers
export const getAccessToken = () => localStorage.getItem('carzodrive_access_token');
export const setAccessToken = (token) => {
  if (token) localStorage.setItem('carzodrive_access_token', token);
  else localStorage.removeItem('carzodrive_access_token');
};

export const getRefreshToken = () => localStorage.getItem('carzodrive_refresh_token');
export const setRefreshToken = (token) => {
  if (token) localStorage.setItem('carzodrive_refresh_token', token);
  else localStorage.removeItem('carzodrive_refresh_token');
};

export const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('carzodrive_user');
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    let parsed = JSON.parse(raw);
    while (parsed && parsed.user && typeof parsed.user === 'object') {
      parsed = parsed.user;
    }
    if (parsed && parsed.data && typeof parsed.data === 'object') {
      parsed = parsed.data;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const setCurrentUser = (user) => {
  if (user && typeof user === 'object') {
    let cleanUser = user;
    while (cleanUser && cleanUser.user && typeof cleanUser.user === 'object') {
      cleanUser = cleanUser.user;
    }
    if (cleanUser && cleanUser.data && typeof cleanUser.data === 'object') {
      cleanUser = cleanUser.data;
    }
    try {
      localStorage.setItem('carzodrive_user', JSON.stringify(cleanUser));
    } catch {
      // ignore
    }
  } else {
    localStorage.removeItem('carzodrive_user');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('carzodrive-auth-change', { detail: { user } }));
  }
};

export const clearAuthSession = () => {
  setAccessToken(null);
  setRefreshToken(null);
  setCurrentUser(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('carzodrive-auth-change', { detail: { user: null } }));
  }
};

export const isAdminUser = (user) => {
  if (!user || !user.role) return false;
  const role = String(user.role).toUpperCase();
  return (
    role.includes('ADMIN') ||
    role === 'SUPER_ADMIN' ||
    ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN', 'FINANCE_ADMIN', 'STAFF_ADMIN', 'ADMIN'].includes(role)
  );
};


// Client-Side In-Memory Cache & In-Flight Request Deduplication for Instant UI
const clientCache = new Map();
const inFlightRequests = new Map();
const DEFAULT_CLIENT_TTL = 30 * 1000; // 30 seconds

export const invalidateClientCache = (prefix = '') => {
  if (!prefix) {
    clientCache.clear();
  } else {
    for (const key of clientCache.keys()) {
      if (key.startsWith(prefix) || key.includes(prefix)) {
        clientCache.delete(key);
      }
    }
  }
};

/**
 * Universal API Request Wrapper with Auto-Auth Headers & JSON Handling
 */
export async function apiRequest(endpoint, { method = 'GET', body, headers = {}, skipCache = false, ...customOptions } = {}) {
  const isGet = method.toUpperCase() === 'GET';
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Purge relevant cache on state-modifying requests
  if (!isGet) {
    if (endpoint.includes('/bookings') || endpoint.includes('/payments')) {
      invalidateClientCache();
    } else if (endpoint.includes('/vehicles')) {
      invalidateClientCache('/vehicles');
    } else if (endpoint.includes('/bikes')) {
      invalidateClientCache('/bikes');
    } else if (endpoint.includes('/packages') || endpoint.includes('/tours')) {
      invalidateClientCache('/packages');
    } else if (endpoint.includes('/drivers')) {
      invalidateClientCache('/drivers');
    } else {
      invalidateClientCache();
    }
  }

  // Return cached result if fresh
  const cacheKey = `${url}`;
  if (isGet && !skipCache) {
    const cached = clientCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    // Deduplicate in-flight concurrent requests to the exact same URL
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }
  }

  const token = getAccessToken();
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const options = {
    method,
    headers: requestHeaders,
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...customOptions,
  };

  const fetchPromise = (async () => {
    try {
      let response;
      try {
        response = await fetch(url, options);
      } catch (networkErr) {
        // Automatic fallback on network failure (e.g. if relative /api/v1 proxy or direct localhost:5000 was unreachable)
        const isLocal = typeof window !== 'undefined' && (
          window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1'
        );

        if (isLocal && url.startsWith('/api/v1')) {
          try {
            const directUrl = `http://localhost:5000${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
            response = await fetch(directUrl, options);
          } catch {
            // direct attempt also failed
          }
        } else if (isLocal && url.includes('localhost:5000')) {
          try {
            const proxyUrl = `/api/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
            response = await fetch(proxyUrl, options);
          } catch {
            // proxy attempt also failed
          }
        }

        if (!response) {
          try {
            const remoteUrl = `https://carzodrive-1.onrender.com/api/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
            const remoteRes = await fetch(remoteUrl, options);
            if (remoteRes.ok) {
              response = remoteRes;
            }
          } catch {
            // remote attempt failed
          }
        }

        if (!response) {
          const isRemote = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
          const errorMsg = isRemote
            ? 'Server se connection establish nahi ho paya. Backend server wake up ho raha ho sakta hai, kripya 10 second baad dobara try karein.'
            : 'Backend server unreachable hai. Kripya check karein ki backend terminal me "npm run dev" chal raha hai (port 5000 pe).';
          const err = new Error(errorMsg);
          err.isNetworkError = true;
          throw err;
        }
      }

      // If local proxy returned 502/503 (e.g. backend offline or starting), try remote fallback
      if (response && (response.status === 502 || response.status === 503 || response.status === 504) && !url.includes('onrender.com')) {
        try {
          const remoteUrl = `https://carzodrive-1.onrender.com/api/v1${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
          const remoteRes = await fetch(remoteUrl, options);
          if (remoteRes.ok) {
            response = remoteRes;
          }
        } catch {
          // remote attempt failed
        }
      }

      const data = await response.json().catch(() => ({}));

      // Cache successful GET responses in memory
      if (response.ok && isGet && !skipCache) {
        clientCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + DEFAULT_CLIENT_TTL,
        });
      }

      // Auto-refresh token if 401 and token expired
      if (response.status === 401 && (data?.message === 'Token expired' || data?.message === 'Invalid token')) {
      const refreshToken = getRefreshToken();
      if (refreshToken && endpoint !== '/auth/refresh') {
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          const refreshData = await refreshRes.json().catch(() => ({}));
          if (refreshRes.ok && refreshData?.data?.accessToken) {
            setAccessToken(refreshData.data.accessToken);
            if (refreshData.data.refreshToken) {
              setRefreshToken(refreshData.data.refreshToken);
            }
            // Retry original request with newly refreshed access token
            requestHeaders.Authorization = `Bearer ${refreshData.data.accessToken}`;
            const retryRes = await fetch(url, { ...options, headers: requestHeaders });
            const retryData = await retryRes.json().catch(() => ({}));
            if (retryRes.ok) return retryData;
          }
        } catch {
          // Refresh attempt failed
        }
      }

      // If refresh failed or was not possible, clear stale auth session
      clearAuthSession();
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
        window.location.href = '/admin/login';
      }
    }

    if (!response.ok) {
      const errorMessage =
        data?.errors?.[0]?.msg ||
        data?.message ||
        `Request failed with status ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } finally {
    if (isGet) {
      inFlightRequests.delete(cacheKey);
    }
  }
})();

  if (isGet && !skipCache) {
    inFlightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}

/**
 * Authentication API Endpoints
 */
export const authAPI = {
  async register({ name, email, phone, password }) {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: { name, email, phone, password },
    });
    if (res?.data?.accessToken) {
      setAccessToken(res.data.accessToken);
      setRefreshToken(res.data.refreshToken);
      setCurrentUser(res.data.user);
    }
    return res;
  },

  async login({ email, password }) {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if (res?.data?.accessToken) {
      setAccessToken(res.data.accessToken);
      setRefreshToken(res.data.refreshToken);
      setCurrentUser(res.data.user);
    }
    return res;
  },

  async adminLogin({ email, password }) {
    const res = await apiRequest('/auth/admin-login', {
      method: 'POST',
      body: { email, password },
    });
    if (res?.data?.accessToken) {
      setAccessToken(res.data.accessToken);
      setRefreshToken(res.data.refreshToken);
      setCurrentUser(res.data.user);
    }
    return res;
  },


  async forgotPassword(email) {
    return apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
  },

  async resetPassword({ token, email, password }) {
    return apiRequest('/auth/reset-password', {
      method: 'POST',
      body: { token, email, password },
    });
  },

  async getMe() {
    const res = await apiRequest('/auth/me');
    if (res?.data) {
      setCurrentUser(res.data);
    }
    return res;
  },

  async logout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      clearAuthSession();
    }
  },
};

/**
 * Vehicles API Endpoints
 */
export const vehiclesAPI = {
  async getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/vehicles${query ? `?${query}` : ''}`);
  },

  async getBySlugOrId(idOrSlug) {
    return apiRequest(`/vehicles/${idOrSlug}`);
  },

  async create(vehicleData) {
    return apiRequest('/vehicles', {
      method: 'POST',
      body: vehicleData,
    });
  },

  async update(vehicleId, vehicleData) {
    return apiRequest(`/vehicles/${vehicleId}`, {
      method: 'PUT',
      body: vehicleData,
    });
  },

  async delete(vehicleId) {
    return apiRequest(`/vehicles/${vehicleId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Bikes API Endpoints
 */
export const bikesAPI = {
  async getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/bikes${query ? `?${query}` : ''}`);
  },

  async getBySlugOrId(idOrSlug) {
    return apiRequest(`/bikes/${idOrSlug}`);
  },

  async create(bikeData) {
    return apiRequest('/bikes', {
      method: 'POST',
      body: bikeData,
    });
  },

  async update(bikeId, bikeData) {
    return apiRequest(`/bikes/${bikeId}`, {
      method: 'PUT',
      body: bikeData,
    });
  },

  async delete(bikeId) {
    return apiRequest(`/bikes/${bikeId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Drivers API Endpoints (Admin Verification & Management)
 */
export const driversAPI = {
  async register(driverData) {
    return apiRequest('/drivers/register', {
      method: 'POST',
      body: driverData,
    });
  },

  async create(driverData) {
    return apiRequest('/drivers', {
      method: 'POST',
      body: driverData,
    });
  },

  async getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/drivers${query ? `?${query}` : ''}`);
  },

  async getById(driverId) {
    return apiRequest(`/drivers/${driverId}`);
  },

  async approve(driverId) {
    return apiRequest(`/drivers/${driverId}/approve`, {
      method: 'POST',
    });
  },

  async reject(driverId, reason = 'Application details incomplete') {
    return apiRequest(`/drivers/${driverId}/reject`, {
      method: 'POST',
      body: { reason },
    });
  },

  async suspend(driverId, reason = 'Administrative review') {
    return apiRequest(`/drivers/${driverId}/suspend`, {
      method: 'POST',
      body: { reason },
    });
  },

  async delete(driverId) {
    return apiRequest(`/drivers/${driverId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Health Check API
 */
export const healthAPI = {
  async check() {
    return apiRequest('/health');
  },
};

/**
 * Admins & Staff Access Control API (RBAC & Granular Permissions)
 */
export const adminsAPI = {
  async getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/admins${query ? `?${query}` : ''}`);
  },

  async getPermissions() {
    return apiRequest('/admins/permissions');
  },

  async create(adminData) {
    return apiRequest('/admins', {
      method: 'POST',
      body: adminData,
    });
  },

  async update(id, adminData) {
    return apiRequest(`/admins/${id}`, {
      method: 'PUT',
      body: adminData,
    });
  },

  async updateStatus(id, status) {
    return apiRequest(`/admins/${id}/status`, {
      method: 'PATCH',
      body: { status },
    });
  },

  async delete(id) {
    return apiRequest(`/admins/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Users API Endpoints (Admin Customer Management & Lookups)
 */
export const usersAPI = {
  async getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/users${query ? `?${query}` : ''}`);
  },

  async getById(id) {
    return apiRequest(`/users/${id}`);
  },
};

/**
 * Packages API Endpoints
 */
export const packagesAPI = {
  async getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/packages${query ? `?${query}` : ''}`);
  },

  async getByIdOrSlug(idOrSlug) {
    return apiRequest(`/packages/${idOrSlug}`);
  },

  async create(packageData) {
    return apiRequest('/packages', {
      method: 'POST',
      body: packageData,
    });
  },

  async update(id, packageData) {
    return apiRequest(`/packages/${id}`, {
      method: 'PUT',
      body: packageData,
    });
  },

  async delete(id) {
    return apiRequest(`/packages/${id}`, {
      method: 'DELETE',
    });
  },
};

/**
 * Bookings API Endpoints (3-Way Payment, Guest Checkout & Admin Management)
 */
export const bookingsAPI = {
  async create(bookingData) {
    return apiRequest('/bookings', {
      method: 'POST',
      body: bookingData,
    });
  },

  async createAdminBooking(bookingData) {
    return apiRequest('/bookings/admin/create', {
      method: 'POST',
      body: bookingData,
    });
  },

  async getByCode(bookingCode) {
    return apiRequest(`/bookings/voucher/${bookingCode}`);
  },

  async lookup(query) {
    const params = new URLSearchParams({ query }).toString();
    return apiRequest(`/bookings/lookup?${params}`);
  },

  async getAll(params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/bookings${query ? `?${query}` : ''}`, options);
  },

  async getById(id) {
    return apiRequest(`/bookings/${id}`);
  },

  async updateStatus(id, status, note = '', paymentStatus = undefined) {
    return apiRequest(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: { status, note, paymentStatus },
    });
  },

  async update(id, bookingData) {
    return apiRequest(`/bookings/${id}`, {
      method: 'PUT',
      body: bookingData,
    });
  },

  async delete(id) {
    return apiRequest(`/bookings/${id}`, {
      method: 'DELETE',
    });
  },

  async getInvoice(idOrCode) {
    return apiRequest(`/bookings/${idOrCode}/invoice`);
  },

  async verifyDocuments(id, { verified = true, notes = '' } = {}) {
    return apiRequest(`/bookings/${id}/verify-documents`, {
      method: 'PATCH',
      body: { verified, notes },
    });
  },

  async attachDocument(id, { name, type, url }) {
    return apiRequest(`/bookings/${id}/documents`, {
      method: 'POST',
      body: { name, type, url },
    });
  },

  async resendEmail(idOrCode, email = null) {
    return apiRequest(`/bookings/${idOrCode}/resend-email`, {
      method: 'POST',
      body: email ? { email } : {},
    });
  },
};

/**
 * Settings & Promotional Discounts API Endpoints
 */
export const settingsAPI = {
  async getDiscount() {
    return apiRequest('/settings/discount');
  },

  async updateDiscount(discountData) {
    const res = await apiRequest('/settings/discount', {
      method: 'PUT',
      body: discountData,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('carzodrive-discount-change', { detail: res?.data || res }));
    }
    return res;
  },

  async getDriverSettings() {
    return apiRequest('/settings/driver');
  },

  async updateDriverSettings(driverData) {
    const res = await apiRequest('/settings/driver', {
      method: 'PUT',
      body: driverData,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('carzodrive-driver-settings-change', { detail: res?.data || res }));
    }
    return res;
  },
};

/**
 * Payments API Endpoints (Dynamic Checkout, Reconciliation, Offline Verification & Invoicing)
 */
export const paymentsAPI = {
  async processCheckout(checkoutData) {
    return apiRequest('/payments/checkout', {
      method: 'POST',
      body: checkoutData,
    });
  },

  async getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/payments${query ? `?${query}` : ''}`);
  },

  async getByIdOrNumber(idOrNumber) {
    return apiRequest(`/payments/details/${idOrNumber}`);
  },

  async getByBooking(bookingId) {
    return apiRequest(`/payments/booking/${bookingId}`);
  },

  async updateStatus(paymentId, { status, notes, approve } = {}) {
    return apiRequest(`/payments/${paymentId}/status`, {
      method: 'PATCH',
      body: { status, notes, approve },
    });
  },

  async verifyOffline(paymentId, { approve, notes } = {}) {
    return apiRequest(`/payments/${paymentId}/verify-offline`, {
      method: 'POST',
      body: { approve, notes },
    });
  },

  async refund(bookingId, { amount, reason }) {
    return apiRequest(`/payments/booking/${bookingId}/refund`, {
      method: 'POST',
      body: { amount, reason },
    });
  },
};

/**
 * Vendors & Host Vehicle Attachment API
 */
export const vendorsAPI = {
  async attachCar(carData) {
    return apiRequest('/vendors/attach-car', {
      method: 'POST',
      body: carData,
    });
  },

  async attachBike(bikeData) {
    return apiRequest('/vendors/attach-bike', {
      method: 'POST',
      body: bikeData,
    });
  },

  async getMyFleet() {
    return apiRequest('/vendors/my-fleet');
  },

  async getAdminSubmissions(params = {}) {
    const cleanParams = {};
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '' && val !== 'ALL' && val !== 'undefined' && val !== 'null') {
          cleanParams[key] = val;
        }
      });
    }
    const query = new URLSearchParams(cleanParams).toString();
    return apiRequest(`/vendors/admin/submissions${query ? `?${query}` : ''}`);
  },

  async approveSubmission(type, id) {
    return apiRequest(`/vendors/admin/submissions/${type}/${id}/approve`, {
      method: 'PATCH',
    });
  },

  async rejectSubmission(type, id, reason = '') {
    return apiRequest(`/vendors/admin/submissions/${type}/${id}/reject`, {
      method: 'PATCH',
      body: { reason },
    });
  },

  async deleteSubmission(type, id) {
    return apiRequest(`/vendors/admin/submissions/${type}/${id}`, {
      method: 'DELETE',
    });
  },

  async updateSubmission(type, id, data) {
    return apiRequest(`/vendors/admin/submissions/${type}/${id}`, {
      method: 'PUT',
      body: data,
    });
  },
};

/**
 * Cloudinary & Media Uploads API
 */
export const uploadsAPI = {
  async uploadImage(file, { folder = 'carzodrive', prefix = 'upload' } = {}) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', folder);
    formData.append('prefix', prefix);

    const token = getAccessToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/uploads/image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Image upload failed');
    }
    return data;
  },

  async uploadImages(files, { folder = 'carzodrive', prefix = 'upload' } = {}) {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('images', file);
    });
    formData.append('folder', folder);
    formData.append('prefix', prefix);

    const token = getAccessToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/uploads/images`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Multiple images upload failed');
    }
    return data;
  },
};

