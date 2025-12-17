import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';
import { User } from '../../src/models/user.model';

describe('Admin compliance audit trails', () => {
  beforeAll(async () => {
    await connectDb();
  });
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('rejects non-admin access', async () => {
    await request(app)
      .get('/api/admin/compliance/audit-trails')
      .set('x-user-role', 'landlord')
      .set('x-admin', 'true')
      .expect(403);
  });

  it('returns audit trail summaries and supports filtering by status', async () => {
    const landlord = await User.create({
      name: 'Landlord',
      email: 'landlord@test.local',
      passwordHash: 'x',
      role: 'landlord',
    });
    const tenant = await User.create({
      name: 'Tenant',
      email: 'tenant@test.local',
      passwordHash: 'x',
      role: 'tenant',
    });

    const c1 = await Contract.create({
      landlord: landlord._id,
      tenant: tenant._id,
      property: '507f1f77bcf86cd799439013',
      rent: 700,
      deposit: 700,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      region: 'general',
      clauses: [],
      status: 'signed',
      signature: {
        status: 'completed',
        envelopeId: 'env_admin_1',
        auditPdfUrl: '/api/contracts/x/audit-trail?format=pdf',
        auditPdfHash: 'a'.repeat(64),
        updatedAt: new Date('2025-01-10T10:00:00Z'),
      },
    });
    await Contract.updateOne({ _id: c1._id }, { $set: { updatedAt: new Date('2025-01-10T10:00:00Z') } }, { timestamps: false } as any);

    const res = await request(app)
      .get('/api/admin/compliance/audit-trails?status=completed')
      .set('x-user-role', 'admin')
      .set('x-admin', 'true')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('contractId');
    expect(res.body.data[0].status).toBe('completed');
    expect(res.body.data[0].auditPdfUrl).toBe('/api/contracts/x/audit-trail?format=pdf');
    expect(res.body.data[0].auditHash).toMatch(/^[a]{64}$/);
    expect(res.body.data[0].user?.email).toBe('landlord@test.local');
  });

  it('should filter by date range', async () => {
    const landlord = await User.create({ name: 'LL', email: 'll@test.local', passwordHash: 'x', role: 'landlord' });
    const tenant = await User.create({ name: 'TT', email: 'tt@test.local', passwordHash: 'x', role: 'tenant' });

    const cOld = await Contract.create({
      landlord: landlord._id,
      tenant: tenant._id,
      property: '507f1f77bcf86cd799439013',
      rent: 700,
      deposit: 700,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      region: 'general',
      clauses: [],
      status: 'signed',
      signature: { status: 'completed', auditPdfHash: 'b'.repeat(64) },
    });
    await Contract.updateOne({ _id: cOld._id }, { $set: { updatedAt: new Date('2025-01-01T00:00:00Z') } }, { timestamps: false } as any);

    const cIn = await Contract.create({
      landlord: landlord._id,
      tenant: tenant._id,
      property: '507f1f77bcf86cd799439013',
      rent: 700,
      deposit: 700,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      region: 'general',
      clauses: [],
      status: 'signed',
      signature: { status: 'completed', auditPdfHash: 'c'.repeat(64) },
    });
    await Contract.updateOne({ _id: cIn._id }, { $set: { updatedAt: new Date('2025-01-10T00:00:00Z') } }, { timestamps: false } as any);

    const res = await request(app)
      .get('/api/admin/compliance/audit-trails?dateFrom=2025-01-05&dateTo=2025-01-15&status=completed')
      .set('x-user-role', 'admin')
      .set('x-admin', 'true')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].auditHash).toBe('c'.repeat(64));
  });

  it('should filter by userId', async () => {
    const landlordA = await User.create({ name: 'A', email: 'a@test.local', passwordHash: 'x', role: 'landlord' });
    const landlordB = await User.create({ name: 'B', email: 'b@test.local', passwordHash: 'x', role: 'landlord' });
    const tenant = await User.create({ name: 'T', email: 't@test.local', passwordHash: 'x', role: 'tenant' });

    await Contract.create({
      landlord: landlordA._id,
      tenant: tenant._id,
      property: '507f1f77bcf86cd799439013',
      rent: 700,
      deposit: 700,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      region: 'general',
      clauses: [],
      status: 'signed',
      signature: { status: 'completed', auditPdfHash: 'd'.repeat(64) },
    });

    await Contract.create({
      landlord: landlordB._id,
      tenant: tenant._id,
      property: '507f1f77bcf86cd799439013',
      rent: 700,
      deposit: 700,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      region: 'general',
      clauses: [],
      status: 'signed',
      signature: { status: 'completed', auditPdfHash: 'e'.repeat(64) },
    });

    const res = await request(app)
      .get(`/api/admin/compliance/audit-trails?userId=${String(landlordA._id)}&status=completed`)
      .set('x-user-role', 'admin')
      .set('x-admin', 'true')
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].auditHash).toBe('d'.repeat(64));
  });

  it('should combine filters (userId + status) and return empty if no match', async () => {
    const landlord = await User.create({ name: 'LL', email: 'll2@test.local', passwordHash: 'x', role: 'landlord' });
    const tenant = await User.create({ name: 'TT', email: 'tt2@test.local', passwordHash: 'x', role: 'tenant' });

    await Contract.create({
      landlord: landlord._id,
      tenant: tenant._id,
      property: '507f1f77bcf86cd799439013',
      rent: 700,
      deposit: 700,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      region: 'general',
      clauses: [],
      status: 'signed',
      signature: { status: 'sent', auditPdfHash: 'f'.repeat(64) },
    });

    const res = await request(app)
      .get(`/api/admin/compliance/audit-trails?userId=${String(landlord._id)}&status=completed`)
      .set('x-user-role', 'admin')
      .set('x-admin', 'true')
      .expect(200);

    expect(res.body.data).toEqual([]);
  });
});
