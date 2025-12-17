import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';
import { ContractSignatureEvent } from '../../src/models/contractSignatureEvent.model';

describe('Admin audit trails export', () => {
  beforeAll(async () => {
    await connectDb();
  });
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('requires admin', async () => {
    await request(app)
      .get('/api/admin/compliance/audit-trails/export?format=zip&contractIds=abc')
      .set('x-user-role', 'landlord')
      .set('x-admin', 'true')
      .expect(403);
  });

  it('returns a zip for selected contracts', async () => {
    process.env.SIGN_WEBHOOK_SECRET = process.env.SIGN_WEBHOOK_SECRET || 'secret';
    const contract = await Contract.create({
      landlord: '507f1f77bcf86cd799439011',
      tenant: '507f1f77bcf86cd799439012',
      property: '507f1f77bcf86cd799439013',
      rent: 700,
      deposit: 700,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      region: 'general',
      clauses: [],
      status: 'pending_signature',
      signature: { status: 'completed', auditPdfHash: 'a'.repeat(64) },
    });
    await ContractSignatureEvent.create({
      contractId: String(contract._id),
      eventType: 'completed',
      timestamp: new Date(),
      previousHash: 'GENESIS',
      currentHash: 'b'.repeat(64),
      userAgent: 'jest',
    } as any);

    const res = await request(app)
      .get(`/api/admin/compliance/audit-trails/export?format=zip&contractIds=${String(contract._id)}`)
      .set('x-user-role', 'admin')
      .set('x-admin', 'true')
      .buffer(true)
      .parse((res2, cb) => {
        const data: Buffer[] = [];
        res2.on('data', chunk => data.push(chunk));
        res2.on('end', () => cb(null, Buffer.concat(data)));
      })
      .expect(200);

    expect(res.headers['content-type']).toMatch(/application\/zip/);
    const buf = res.body as Buffer;
    expect(buf.slice(0, 2).toString('utf8')).toBe('PK');
  });
});

