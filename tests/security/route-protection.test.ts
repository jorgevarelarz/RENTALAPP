/**
 * Tests for P0 route protection changes:
 * - /api/testing/inbound/* gated in production
 * - /api/notify/* requires auth + admin
 * - /api/verification/* requires auth
 * - /api/kyc/start requires auth; /api/kyc/webhook verifies HMAC
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';

let app: any;
let mongo: Awaited<ReturnType<typeof startMongoMemoryServer>> | null = null;
let adminToken: string;

async function withoutTestAuth<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.ALLOW_TEST_AUTH;
  process.env.ALLOW_TEST_AUTH = 'false';
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.ALLOW_TEST_AUTH;
    else process.env.ALLOW_TEST_AUTH = prev;
  }
}

beforeAll(async () => {
  mongo = await startMongoMemoryServer();
  process.env.MONGO_URL = mongo.getUri();
  process.env.NODE_ENV = 'test';
  process.env.ALLOW_TEST_AUTH = 'true';
  process.env.ALLOW_UNVERIFIED = 'true';
  await mongoose.connect(mongo.getUri());
  const mod = await import('../../src/app');
  app = mod.app || mod.default;

  // Register an admin user and get token
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Admin', email: 'admin@test.com', password: 'password123', role: 'admin' });
  adminToken = res.body.token;
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongo) { await mongo.stop(); mongo = null; }
});

// ---------------------------------------------------------------------------
// /api/testing/inbound — dev-only routes
// ---------------------------------------------------------------------------
describe('/api/testing/inbound — accessible in non-production', () => {
  it('GET /api/testing/inbound/leads returns data (not 404) in test env', async () => {
    const res = await request(app).get('/api/testing/inbound/leads');
    // Should succeed (200) or fail for business reasons, but NOT 404 (which is the prod guard)
    expect(res.status).not.toBe(404);
  });
});

// ---------------------------------------------------------------------------
// /api/notify — requires auth + admin, gated in production
// ---------------------------------------------------------------------------
describe('/api/notify — auth + admin required', () => {
  it('POST /api/notify/email returns 401 without token', async () => {
    const res = await withoutTestAuth(() => request(app)
      .post('/api/notify/email')
      .send({ to: 'x@x.com', subject: 'hi', body: 'test' }));
    expect(res.status).toBe(401);
  });

  it('POST /api/notify/sms returns 401 without token', async () => {
    const res = await withoutTestAuth(() => request(app)
      .post('/api/notify/sms')
      .send({ to: '+34600000000', body: 'test' }));
    expect(res.status).toBe(401);
  });

  it('POST /api/notify/email returns 403 for non-admin user', async () => {
    // Register a landlord
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Landlord', email: 'landlord-notify@test.com', password: 'password123', role: 'landlord' });
    const landlordToken = reg.body.token;

    const res = await request(app)
      .post('/api/notify/email')
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ to: 'x@x.com', subject: 'hi', body: 'test' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// /api/verification — requires authentication
// ---------------------------------------------------------------------------
describe('/api/verification — authentication required', () => {
  it('GET /api/verification/me returns 401 without token', async () => {
    const res = await withoutTestAuth(() => request(app).get('/api/verification/me'));
    expect(res.status).toBe(401);
  });

  it('POST /api/verification/submit returns 401 without token', async () => {
    const res = await withoutTestAuth(() => request(app)
      .post('/api/verification/submit')
      .send({ method: 'document', files: [] }));
    expect(res.status).toBe(401);
  });

  it('GET /api/verification/me returns data for authenticated user', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Tenant', email: 'tenant-verify@test.com', password: 'password123', role: 'tenant' });
    const token = reg.body.token;

    const res = await request(app)
      .get('/api/verification/me')
      .set('Authorization', `Bearer ${token}`);
    // Either returns a status object (200) or unverified (200) — not 401
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// /api/kyc — /start requires auth, /webhook verifies HMAC when secret set
// ---------------------------------------------------------------------------
describe('/api/kyc — authentication and HMAC', () => {
  it('POST /api/kyc/start returns 401 without token', async () => {
    const res = await withoutTestAuth(() => request(app)
      .post('/api/kyc/start')
      .send({ returnUrl: 'https://example.com' }));
    expect(res.status).toBe(401);
  });

  it('POST /api/kyc/webhook returns 400 if STRIPE_IDENTITY_WEBHOOK_SECRET set and signature missing', async () => {
    const prev = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = 'whsec_test_secret';
    try {
      const res = await request(app)
        .post('/api/kyc/webhook')
        .set('Content-Type', 'application/json')
        .send({ sessionId: 'sess_123', status: 'verified' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/missing_signature/);
    } finally {
      if (prev === undefined) delete process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
      else process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = prev;
    }
  });

  it('POST /api/kyc/webhook succeeds without signature when no secret configured', async () => {
    const prev = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
    delete process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
    try {
      const res = await request(app)
        .post('/api/kyc/webhook')
        .send({ sessionId: 'sess_mock_123', status: 'verified' });
      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
    } finally {
      if (prev !== undefined) process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = prev;
    }
  });
});
