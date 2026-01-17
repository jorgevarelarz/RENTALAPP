import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Types } from 'mongoose';
import { User } from '../../src/models/user.model';
import { ComplianceStatus } from '../../src/modules/rentalPublic/models/complianceStatus.model';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';

const signToken = (payload: any) => jwt.sign(payload, JWT_SECRET);

describe('Institution compliance API', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('rejects invalid date ranges for institution dashboard', async () => {
    const user = await User.create({
      name: 'Institution User',
      email: 'institution@example.com',
      passwordHash: 'hash',
      role: 'institution_viewer',
      institutionScope: { areaKeys: ['galicia|oleiros|'] },
    });

    const token = signToken({ _id: String(user._id), role: 'institution_viewer' });

    await request(app)
      .get('/api/institution/compliance/dashboard?dateFrom=invalid-date')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(app)
      .get('/api/institution/compliance/dashboard?dateFrom=2025-01-10&dateTo=2025-01-01')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('rejects invalid date ranges for institution export', async () => {
    const user = await User.create({
      name: 'Institution User',
      email: 'institution-export@example.com',
      passwordHash: 'hash',
      role: 'institution_viewer',
      institutionScope: { areaKeys: ['galicia|oleiros|'] },
    });

    const token = signToken({ _id: String(user._id), role: 'institution_viewer' });

    await request(app)
      .get('/api/institution/compliance/dashboard/export.csv?dateFrom=invalid-date')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(app)
      .get('/api/institution/compliance/dashboard/export.csv?dateFrom=2025-01-10&dateTo=2025-01-01')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('exports compliance CSV with scoped data rows', async () => {
    const user = await User.create({
      name: 'Institution User',
      email: 'institution-csv@example.com',
      passwordHash: 'hash',
      role: 'institution_viewer',
      institutionScope: { areaKeys: ['galicia|oleiros|'] },
    });
    const token = signToken({ _id: String(user._id), role: 'institution_viewer' });

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
      .get('/api/institution/compliance/dashboard/export.csv')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.text).toContain('case_id,areaKey,previousRent,newRent,status,checkedAt');
  });
});
