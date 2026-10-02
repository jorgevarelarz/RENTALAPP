import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/app';
import { Contract } from '../../src/models/contract.model';
import { ContractSignatureEvent } from '../../src/models/contractSignatureEvent.model';
import { ProcessedEvent } from '../../src/models/processedEvent.model';
import { verifyConnectHmac } from '../../src/services/signature/docusign.provider';
import { connectDb, disconnectDb, clearDb } from '../utils/db';

describe('Signature webhook authentication', () => {
  const originalEnv = { ...process.env };
  let contractId: string;
  const payload = { envelopeId: 'security-envelope', eventId: 'security-event', status: 'sent' };
  const sign = (body: string, secret = 'canonical-secret') =>
    crypto.createHmac('sha256', secret).update(body).digest('hex');

  beforeAll(connectDb);
  afterAll(disconnectDb);
  beforeEach(async () => {
    process.env.SIGN_PROVIDER = 'signaturit';
    process.env.SIGNATURE_WEBHOOK_SECRET = 'canonical-secret';
    delete process.env.SIGN_WEBHOOK_SECRET;
    const contract = await Contract.create({
      landlord: '507f1f77bcf86cd799439011', tenant: '507f1f77bcf86cd799439012',
      property: '507f1f77bcf86cd799439013', rent: 700, deposit: 700,
      startDate: new Date(), endDate: new Date(Date.now() + 86400000),
      region: 'general', clauses: [], status: 'pending_signature',
      signature: { envelopeId: payload.envelopeId, status: 'sent' },
    });
    contractId = contract.id;
  });
  afterEach(async () => {
    process.env = { ...originalEnv };
    await clearDb();
  });

  it.each([undefined, 'invalid', 'a'.repeat(64), sign(JSON.stringify({ ...payload, status: 'signed' }))])(
    'rejects untrusted requests on every signature route without side effects (%s)',
    async (signature) => {
      for (const path of ['/signature/callback', '/signature/webhook', `/${contractId}/signature/callback`]) {
        const req = request(app).post(`/api/contracts${path}`);
        if (signature) req.set('x-signature', signature);
        await req.send(payload).expect(400);
      }
      expect((await Contract.findById(contractId))?.status).toBe('pending_signature');
      expect(await ContractSignatureEvent.countDocuments()).toBe(0);
      expect(await ProcessedEvent.countDocuments()).toBe(0);
    },
  );

  it('accepts the exact signed bytes and prefers the canonical secret over the legacy alias', async () => {
    process.env.SIGN_WEBHOOK_SECRET = 'legacy-secret';
    const raw = JSON.stringify(payload, null, 2);
    await request(app).post('/api/contracts/signature/callback')
      .set('Content-Type', 'application/json').set('x-signature', sign(raw, 'legacy-secret'))
      .send(raw).expect(400);
    await request(app).post('/api/contracts/signature/callback')
      .set('Content-Type', 'application/json').set('x-signature', sign(raw))
      .send(raw).expect(200);
    expect(await ContractSignatureEvent.countDocuments()).toBe(1);
  });

  it('rejects a missing secret in production before changing a contract', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SIGNATURE_WEBHOOK_SECRET;
    await request(app).post('/api/contracts/signature/callback').send(payload).expect(400);
    expect(await ContractSignatureEvent.countDocuments()).toBe(0);
    expect(await ProcessedEvent.countDocuments()).toBe(0);
  });

  it('routes the public DocuSign callback through its HMAC verifier', async () => {
    process.env.SIGN_PROVIDER = 'docusign';
    process.env.DOCUSIGN_WEBHOOK_SECRET = 'docusign-secret';
    const raw = JSON.stringify({ envelopeId: payload.envelopeId, event: 'sent' });
    await request(app).post('/api/contracts/signature/callback')
      .send(JSON.parse(raw)).expect(400);
    const signature = crypto.createHmac('sha256', 'docusign-secret').update(raw).digest('base64');
    await request(app).post('/api/contracts/signature/callback')
      .set('X-DocuSign-Signature-1', signature).send(JSON.parse(raw)).expect(200);
    expect((await Contract.findById(contractId))?.signature?.events).toHaveLength(1);
  });

  it('rejects malformed DocuSign signatures without throwing', () => {
    process.env.DOCUSIGN_WEBHOOK_SECRET = 'docusign-secret';
    expect(verifyConnectHmac('{}', 'short')).toBe(false);
    expect(verifyConnectHmac('{}', undefined)).toBe(false);
    const valid = crypto.createHmac('sha256', 'docusign-secret').update('{}').digest('base64');
    expect(verifyConnectHmac('{}', valid)).toBe(true);
    expect(verifyConnectHmac('{"tampered":true}', valid)).toBe(false);
  });
});
