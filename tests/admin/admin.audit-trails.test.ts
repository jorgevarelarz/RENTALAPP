import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';

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
    await Contract.create({
      landlord: '507f1f77bcf86cd799439011',
      tenant: '507f1f77bcf86cd799439012',
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

    const res = await request(app)
      .get('/api/admin/compliance/audit-trails?status=completed')
      .set('x-user-role', 'admin')
      .set('x-admin', 'true')
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toHaveProperty('contract.id');
    expect(res.body.data[0].status).toBe('completed');
    expect(res.body.data[0].auditPdfUrl).toBe('/api/contracts/x/audit-trail?format=pdf');
    expect(res.body.data[0].hash).toMatch(/^[a]{64}$/);
  });
});

