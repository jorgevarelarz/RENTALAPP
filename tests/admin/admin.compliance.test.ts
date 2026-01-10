import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { UserPolicyAcceptance } from '../../src/models/userPolicyAcceptance.model';
import { PolicyVersion } from '../../src/models/policy.model';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';

const signToken = (payload: any) => jwt.sign(payload, JWT_SECRET);

describe('Admin compliance API', () => {
  beforeAll(async () => {
    await connectDb();
  });
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('rejects non-authenticated and non-admin users', async () => {
    await request(app)
      .get('/api/admin/policies/acceptances')
      .set('Authorization', 'Bearer invalid')
      .expect(401);

    const userToken = signToken({ _id: '507f1f77bcf86cd799439030', role: 'tenant' });
    await request(app)
      .get('/api/admin/policies/acceptances')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('returns acceptances with filters and activeOnly', async () => {
    const adminToken = signToken({ _id: '507f1f77bcf86cd799439000', role: 'admin', isVerified: true });
    await PolicyVersion.create({ policyType: 'terms_of_service', version: 'v1.0', isActive: true });
    await PolicyVersion.create({ policyType: 'data_processing', version: 'v2.0', isActive: true });
    await PolicyVersion.create({ policyType: 'terms_of_service', version: 'v0.9', isActive: false });

    await UserPolicyAcceptance.create({
      userId: '507f1f77bcf86cd799439010',
      policyType: 'terms_of_service',
      policyVersion: 'v1.0',
      acceptedAt: new Date(),
      ip: '127.0.0.1',
      userAgent: 'jest',
    });
    await UserPolicyAcceptance.create({
      userId: '507f1f77bcf86cd799439010',
      policyType: 'data_processing',
      policyVersion: 'v2.0',
      acceptedAt: new Date(),
      ip: '127.0.0.1',
      userAgent: 'jest',
    });
    await UserPolicyAcceptance.create({
      userId: '507f1f77bcf86cd799439010',
      policyType: 'terms_of_service',
      policyVersion: 'v0.9',
      acceptedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/admin/policies/acceptances?activeOnly=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-admin', 'true')
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toHaveProperty('policyType');
    expect(res.body.data[0]).toHaveProperty('policyVersion');
    expect(res.body.data[0]).toHaveProperty('user.email');
  });
});
