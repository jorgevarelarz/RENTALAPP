import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';
import { ContractSignatureEvent } from '../../src/models/contractSignatureEvent.model';

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
};

describe('Contract signature audit trail', () => {
  beforeAll(async () => {
    await connectDb();
  });
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('records signature events with a valid hash chain', async () => {
    process.env.SIGN_WEBHOOK_SECRET = 'secret';

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
      signature: { envelopeId: 'env_123', status: 'sent' },
    });

    const payload1 = { envelopeId: 'env_123', status: 'sent' };
    const sig1 = crypto
      .createHmac('sha256', process.env.SIGN_WEBHOOK_SECRET)
      .update(JSON.stringify(payload1))
      .digest('hex');
    await request(app)
      .post('/api/contracts/signature/callback')
      .set('x-signature', sig1)
      .set('user-agent', 'jest')
      .send(payload1)
      .expect(200);

    const payload2 = { envelopeId: 'env_123', status: 'completed' };
    const sig2 = crypto
      .createHmac('sha256', process.env.SIGN_WEBHOOK_SECRET)
      .update(JSON.stringify(payload2))
      .digest('hex');
    await request(app)
      .post('/api/contracts/signature/callback')
      .set('x-signature', sig2)
      .set('user-agent', 'jest')
      .send(payload2)
      .expect(200);

    const events = await ContractSignatureEvent.find({ contractId: contract._id }).sort({ timestamp: 1 }).lean();
    expect(events).toHaveLength(2);
    expect(events[0].previousHash).toBe('GENESIS');
    expect(events[0].currentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(events[1].previousHash).toBe(events[0].currentHash);

    // Recompute hashes using the same deterministic algorithm
    const recompute = (evt: any, previousHash: string) => {
      const payload = {
        contractId: String(contract._id),
        userId: null,
        envelopeId: 'env_123',
        provider: (process.env.SIGN_PROVIDER || 'mock').toLowerCase(),
        eventType: evt.eventType,
        timestamp: new Date(evt.timestamp).toISOString(),
        ip: evt.ip ?? null,
        userAgent: evt.userAgent ?? null,
      };
      const payloadStr = stableStringify(payload);
      return crypto.createHash('sha256').update(`${previousHash}|${payloadStr}`).digest('hex');
    };

    const h1 = recompute(events[0], 'GENESIS');
    expect(events[0].currentHash).toBe(h1);

    const h2 = recompute(events[1], events[0].currentHash);
    expect(events[1].currentHash).toBe(h2);
  });
});
