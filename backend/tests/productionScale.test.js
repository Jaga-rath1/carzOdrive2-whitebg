require('./setup');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const cache = require('../src/utils/cache');
const { escapeRegex, buildSafeRegex } = require('../src/utils/regex');

beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('Production Scale, Security & Crash-Proof Verification', () => {
  test('1. Health & Database endpoints return clean 200 status and X-Request-Id header', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');

    const dbRes = await request(app).get('/api/v1/health/database');
    expect(dbRes.status).toBe(200);
    expect(dbRes.body.success).toBe(true);
    expect(dbRes.body.data.database.status).toBe('ok');
  });

  test('2. Regex sanitizer safely escapes metacharacters and enforces length limit', () => {
    const raw = '(test)[regex]*+?^$\\{1,100}';
    const escaped = escapeRegex(raw);
    expect(() => new RegExp(escaped, 'i')).not.toThrow();

    const longInput = 'a'.repeat(500);
    const safe = buildSafeRegex(longInput, 100);
    expect(safe.source.length).toBeLessThanOrEqual(100);
  });

  test('3. Public search endpoints reject/handle malicious regex queries with 200 (Zero 500 crash)', async () => {
    const malicious = encodeURIComponent('(a+)+$[invalid\\*?');

    const [vRes, bRes, dRes, pRes] = await Promise.all([
      request(app).get(`/api/v1/vehicles?search=${malicious}&city=${malicious}&brand=${malicious}`),
      request(app).get(`/api/v1/bikes?search=${malicious}&city=${malicious}&category=${malicious}`),
      request(app).get(`/api/v1/drivers?serviceArea=${malicious}`),
      request(app).get(`/api/v1/packages?destination=${malicious}&category=${malicious}`),
    ]);

    expect(vRes.status).toBe(200);
    expect(bRes.status).toBe(200);
    expect(dRes.status).toBe(200);
    expect(pRes.status).toBe(200);
  });

  test('4. Public settings endpoints return valid structure without crashing', async () => {
    const [discRes, drvRes] = await Promise.all([
      request(app).get('/api/v1/settings/discount'),
      request(app).get('/api/v1/settings/driver'),
    ]);

    expect(discRes.status).toBe(200);
    expect(discRes.body.success).toBe(true);
    expect(drvRes.status).toBe(200);
    expect(drvRes.body.success).toBe(true);
  });

  test('5. Malformed JSON request payload returns 400 cleanly without unhandled 500 crash', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "broken-json"');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid JSON/i);
  });

  test('6. Unknown API route returns clean 404 JSON response', async () => {
    const res = await request(app).get('/api/v1/non-existent-route-check');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('7. ProductionCache enforces bounded maxEntries limit without unbounded RAM leak', () => {
    const originalMax = cache.maxEntries;
    cache.maxEntries = 5;
    cache.clear();

    for (let i = 0; i < 10; i++) {
      cache.set(`scale-test:${i}`, { i }, 60);
    }

    expect(cache.store.size).toBe(5);
    expect(cache.get('scale-test:0')).toBeNull(); // oldest evicted
    expect(cache.get('scale-test:9')).toEqual({ i: 9 }); // latest retained

    cache.clear();
    cache.maxEntries = originalMax;
  });
});

