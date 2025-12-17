import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';
const signToken = (payload: any) => jwt.sign(payload, JWT_SECRET);

describe('Contract signature flow', () => {
  beforeAll(async () => {
    process.env.ALLOW_UNVERIFIED = 'true';
    await connectDb();
  });
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('initializes signature and updates status on webhook', async () => {
    const landlordToken = signToken({ _id: '507f1f77bcf86cd799439011', role: 'landlord', isVerified: true });
    // create contract
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
    });

    // policy bypass in tests: ALLOW_POLICY_BYPASS
    process.env.ALLOW_POLICY_BYPASS = 'true';

    const initRes = await request(app)
      .post(`/api/contracts/${contract._id}/signature/init`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .expect(201);

    expect(initRes.body).toHaveProperty('signUrl');
    const envelopeId = initRes.body.envelopeId;

    await request(app)
      .post(`/api/contracts/signature/webhook`)
      .send({ contractId: String(contract._id), eventId: 'evt_123', status: 'signed', provider: 'mock' })
      .expect(200);

    const status = await request(app)
      .get(`/api/contracts/${contract._id}/signature/status`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .expect(200);

    expect(status.body.status).toBeDefined();
  });
});
