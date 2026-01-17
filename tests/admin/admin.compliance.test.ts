import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Types } from 'mongoose';
import { UserPolicyAcceptance } from '../../src/models/userPolicyAcceptance.model';
import { PolicyVersion } from '../../src/models/policy.model';
import { ComplianceStatus } from '../../src/modules/rentalPublic/models/complianceStatus.model';

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

  it('rejects invalid date ranges for compliance dashboard', async () => {
    const adminToken = signToken({ _id: '507f1f77bcf86cd799439000', role: 'admin', isVerified: true });

    await request(app)
      .get('/api/admin/compliance/dashboard?dateFrom=invalid-date')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-admin', 'true')
      .expect(400);

    await request(app)
      .get('/api/admin/compliance/dashboard?dateFrom=2025-01-10&dateTo=2025-01-01')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-admin', 'true')
      .expect(400);
  });

  it('rejects invalid date ranges for compliance export', async () => {
    const adminToken = signToken({ _id: '507f1f77bcf86cd799439000', role: 'admin', isVerified: true });

    await request(app)
      .get('/api/admin/compliance/dashboard/export.csv?dateFrom=invalid-date')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-admin', 'true')
      .expect(400);

    await request(app)
      .get('/api/admin/compliance/dashboard/export.csv?dateFrom=2025-01-10&dateTo=2025-01-01')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-admin', 'true')
      .expect(400);
  });

  it('exports compliance CSV with data rows', async () => {
    const adminToken = signToken({ _id: '507f1f77bcf86cd799439000', role: 'admin', isVerified: true });
    const propertyId = new Types.ObjectId();
    await ComplianceStatus.create({
      contract: new Types.ObjectId(),
      property: propertyId,
      status: 'risk',
      severity: 'warning',
      checkedAt: new Date('2025-01-15T10:00:00.000Z'),
      previousRent: 900,
      newRent: 1100,
      isTensionedArea: true,
      ruleVersion: 'es-housing:v1',
      reasons: ['RENT_INCREASE_TENSIONED_AREA'],
      meta: { areaKey: 'galicia|oleiros|' },
    });

    const res = await request(app)
      .get('/api/admin/compliance/dashboard/export.csv')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-admin', 'true')
      .expect(200);

    expect(res.text).toContain('property_id,areaKey,previousRent,newRent,status,checkedAt');
    expect(res.text).toContain(String(propertyId));
  });
});
