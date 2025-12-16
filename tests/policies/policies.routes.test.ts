import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectDb, clearDb, disconnectDb } from '../utils/db';

let app: any;
const JWT_SECRET = process.env.JWT_SECRET || 'insecure';
const DEFAULT_VERSION = { policyType: 'privacy_policy', version: 'v1.0' };
const DEFAULT_ACCEPT = { policyType: 'privacy_policy', policyVersion: 'v1.0' };

const signToken = (userId: string) =>
  jwt.sign({ _id: userId, email: 'user@test.com' }, JWT_SECRET);

describe('Policy routes', () => {
  beforeAll(async () => {
    await connectDb();
    process.env.JWT_SECRET = JWT_SECRET;
    // Import after DB/env are ready to avoid real connections
    app = (await import('../../src/app')).default;
  });

  afterEach(async () => {
    await clearDb();
  });

  const createVersion = async () => {
    const userId = new mongoose.Types.ObjectId().toHexString();
    const token = signToken(userId);
    await request(app)
      .post('/api/policies/version')
      .set('Authorization', `Bearer ${token}`)
      .send(DEFAULT_VERSION)
      .expect(201);
  };

  afterAll(async () => {
    await disconnectDb();
  });

  test('rejects requests without token (401)', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const res = await request(app).post('/api/policies/accept').send({
      policyType: 'privacy_policy',
      policyVersion: 'v1.0',
    });

    expect(res.status).toBe(401);
    process.env.NODE_ENV = prevEnv;
  });

  test('returns 400 when required fields are missing', async () => {
    const userId = new mongoose.Types.ObjectId().toHexString();
    const token = signToken(userId);
    await createVersion();

    const res = await request(app)
      .post('/api/policies/accept')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('creates a policy acceptance (201)', async () => {
    const userId = new mongoose.Types.ObjectId().toHexString();
    const token = signToken(userId);
    await createVersion();

    const res = await request(app)
      .post('/api/policies/accept')
      .set('Authorization', `Bearer ${token}`)
      .send(DEFAULT_ACCEPT);

    expect(res.status).toBe(201);
    expect(res.body?.data?.policyVersion).toBe('v1.0');
    expect(res.body?.data?.policyType).toBe('privacy_policy');
  });

  test('is idempotent for the same user/policy/version', async () => {
    const userId = new mongoose.Types.ObjectId().toHexString();
    const token = signToken(userId);
    await createVersion();

    const first = await request(app)
      .post('/api/policies/accept')
      .set('Authorization', `Bearer ${token}`)
      .send(DEFAULT_ACCEPT);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/policies/accept')
      .set('Authorization', `Bearer ${token}`)
      .send(DEFAULT_VERSION);

    expect(second.status).toBe(400);
  });

  test('returns accepted policies for the user', async () => {
    const userId = new mongoose.Types.ObjectId().toHexString();
    const token = signToken(userId);
    await createVersion();

    await request(app)
      .post('/api/policies/accept')
      .set('Authorization', `Bearer ${token}`)
      .send(DEFAULT_ACCEPT);

    const res = await request(app)
      .get('/api/policies')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data)).toBe(true);
    expect(res.body.data[0]?.policyVersion).toBe('v1.0');
    expect(res.body.data[0]?.policyType).toBe('privacy_policy');
  });
});
