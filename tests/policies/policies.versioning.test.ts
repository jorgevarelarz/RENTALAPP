import request, { Test } from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectDb, clearDb, disconnectDb } from '../utils/db';

let app: any;
const JWT_SECRET = process.env.JWT_SECRET || 'insecure';

const signToken = (userId: string) =>
  jwt.sign({ _id: userId, email: 'user@test.com' }, JWT_SECRET);

const createVersion = (
  token: string,
  policyType = 'privacy_policy',
  version = 'v1.0',
  expiresAt?: Date | null
): Test => {
  const payload: any = { policyType, version };
  if (expiresAt) payload.expiresAt = expiresAt.toISOString();

  return request(app)
    .post('/api/policies/version')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);
};

describe('Policy versioning and expiration', () => {
  beforeAll(async () => {
    await connectDb();
    process.env.JWT_SECRET = JWT_SECRET;
    app = (await import('../../src/app')).default;
  });

  afterEach(async () => {
    await clearDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('rejects acceptance of obsolete version (409) and returns latest active', async () => {
    const adminId = new mongoose.Types.ObjectId().toHexString();
    const userId = new mongoose.Types.ObjectId().toHexString();
    const adminToken = signToken(adminId);
    const userToken = signToken(userId);

    // Create v1.0 active
    await createVersion(adminToken, 'privacy_policy', 'v1.0').expect(201);

    // User accepts v1.0
    await request(app)
      .post('/api/policies/accept')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ policyType: 'privacy_policy', policyVersion: 'v1.0' })
      .expect(201);

    // Create v1.1 -> should deactivate v1.0
    await createVersion(adminToken, 'privacy_policy', 'v1.1').expect(201);

    // GET active should return v1.1 only
    const activeRes = await request(app)
      .get('/api/policies/active')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(activeRes.body.data[0].version).toBe('v1.1');
    expect(activeRes.body.data[0].isActive).toBe(true);

    // Attempt accepting old version -> 409
    const obsolete = await request(app)
      .post('/api/policies/accept')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ policyType: 'privacy_policy', policyVersion: 'v1.0' });
    expect(obsolete.status).toBe(409);

    // Accept new version succeeds
    await request(app)
      .post('/api/policies/accept')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ policyType: 'privacy_policy', policyVersion: 'v1.1' })
      .expect(201);
  });

  it('treats expired policies as inactive', async () => {
    const adminId = new mongoose.Types.ObjectId().toHexString();
    const userId = new mongoose.Types.ObjectId().toHexString();
    const adminToken = signToken(adminId);
    const userToken = signToken(userId);

    // Create version that is already expired
    const past = new Date(Date.now() - 1000 * 60);
    await createVersion(adminToken, 'privacy_policy', 'v2.0', past).expect(201);

    const activeRes = await request(app)
      .get('/api/policies/active')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(activeRes.body.data).toHaveLength(0);

    // Attempt to accept expired version should 409
    const res = await request(app)
      .post('/api/policies/accept')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ policyType: 'privacy_policy', policyVersion: 'v2.0' });
    expect(res.status).toBe(409);
  });
});
