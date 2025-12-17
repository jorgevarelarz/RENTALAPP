import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';
const signToken = (payload: any) => jwt.sign(payload, JWT_SECRET);

describe('Contract audit trail PDF', () => {
  beforeAll(async () => {
    await connectDb();
  });
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('generates and serves audit PDF on completed signature', async () => {
    process.env.SIGN_WEBHOOK_SECRET = 'secret';
    const landlordId = '507f1f77bcf86cd799439011';
    const landlordToken = signToken({ _id: landlordId, role: 'landlord', isVerified: true });

    const contract = await Contract.create({
      landlord: landlordId,
      tenant: '507f1f77bcf86cd799439012',
      property: '507f1f77bcf86cd799439013',
      rent: 700,
      deposit: 700,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      region: 'general',
      clauses: [],
      status: 'pending_signature',
      signature: { envelopeId: 'env_pdf_1', status: 'sent' },
    });

    const payload = { envelopeId: 'env_pdf_1', status: 'completed' };
    const sig = crypto
      .createHmac('sha256', process.env.SIGN_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    await request(app)
      .post('/api/contracts/signature/callback')
      .set('x-signature', sig)
      .set('user-agent', 'jest')
      .send(payload)
      .expect(200);

    const updated = await Contract.findById(contract._id).lean();
    expect(updated?.signature?.auditPdfUrl).toBeDefined();
    expect(updated?.signature?.auditPdfHash).toMatch(/^[a-f0-9]{64}$/);

    const dir = path.resolve(process.cwd(), 'storage/contracts-audit');
    const abs = path.join(dir, `contract_${String(contract._id)}.pdf`);
    expect(fs.existsSync(abs)).toBe(true);
    expect(fs.statSync(abs).size).toBeGreaterThan(200);

    const pdfRes = await request(app)
      .get(`/api/contracts/${String(contract._id)}/audit-trail?format=pdf`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const data: Buffer[] = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(data)));
      })
      .expect(200);

    expect(pdfRes.headers['content-type']).toMatch(/application\/pdf/);
    expect(Buffer.isBuffer(pdfRes.body)).toBe(true);
    const bodyStr = (pdfRes.body as Buffer).toString('utf8');
    expect(bodyStr.startsWith('%PDF-')).toBe(true);
    expect(bodyStr).toMatch(/PDFKit/);
  });
});
