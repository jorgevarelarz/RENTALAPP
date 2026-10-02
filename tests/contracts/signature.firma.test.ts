import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/app';
import { Contract } from '../../src/models/contract.model';
import { ProcessedEvent } from '../../src/models/processedEvent.model';
import { User } from '../../src/models/user.model';
import { firmaProvider, verifyFirmaSignature } from '../../src/signature/firma';
import { ensureFirmaSignature } from '../../src/services/signature.service';
import { connectDb, disconnectDb, clearDb } from '../utils/db';

const SECRET = 'firma-secret';
const signHeader = (raw: string, t = Math.floor(Date.now() / 1000), secret = SECRET) =>
  `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;

describe('verifyFirmaSignature', () => {
  const raw = '{"id":"evt_1"}';

  it('accepts a fresh signature over the exact bytes', () => {
    expect(verifyFirmaSignature(raw, signHeader(raw), SECRET)).toBe(true);
    expect(verifyFirmaSignature(Buffer.from(raw), signHeader(raw), SECRET)).toBe(true);
  });

  it('rejects wrong secret, tampered body, stale timestamp, malformed header or missing secret', () => {
    expect(verifyFirmaSignature(raw, signHeader(raw, undefined, 'other'), SECRET)).toBe(false);
    expect(verifyFirmaSignature('{"id":"evt_2"}', signHeader(raw), SECRET)).toBe(false);
    expect(verifyFirmaSignature(raw, signHeader(raw, Math.floor(Date.now() / 1000) - 3600), SECRET)).toBe(false);
    expect(verifyFirmaSignature(raw, 't=1,v1=abc', SECRET)).toBe(false);
    expect(verifyFirmaSignature(raw, signHeader(raw), undefined)).toBe(false);
  });
});

describe('Firma.dev integration', () => {
  const originalEnv = { ...process.env };
  let contractId: string;

  beforeAll(async () => {
    await connectDb();
    await ProcessedEvent.init(); // unique (provider, eventId) index must exist before the replay test
  });
  afterAll(disconnectDb);
  beforeEach(async () => {
    process.env.SIGN_PROVIDER = 'firma';
    process.env.FIRMA_WEBHOOK_SECRET = SECRET;
    const contract = await Contract.create({
      landlord: '507f1f77bcf86cd799439011', tenant: '507f1f77bcf86cd799439012',
      property: '507f1f77bcf86cd799439013', rent: 700, deposit: 700,
      startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000),
      region: 'general', clauses: [], status: 'pending_signature',
      signature: { provider: 'firma', envelopeId: 'req_123', status: 'sent' },
    });
    contractId = contract.id;
  });
  afterEach(async () => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
    await clearDb();
  });

  const post = (body: object, header?: string) => {
    const raw = JSON.stringify(body);
    const req = request(app).post('/api/contracts/signature/firma').set('Content-Type', 'application/json');
    if (header !== undefined) req.set('x-firma-signature', header);
    return req.send(raw);
  };

  it('is reachable without a user session but rejects unsigned events', async () => {
    const body = { id: 'evt_1', type: 'signing_request.completed', data: { signing_request: { id: 'req_123' } } };
    const res = await post(body);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_signature');
    expect((await Contract.findById(contractId))?.status).toBe('pending_signature');
    expect(await ProcessedEvent.countDocuments()).toBe(0);
  });

  it('marks the contract signed on completion, stores the PDF hash and ignores the replay', async () => {
    const pdf = Buffer.from('%PDF-1.4 signed');
    const download = jest.spyOn(firmaProvider, 'downloadFinalPdf').mockResolvedValue(pdf);
    const body = { id: 'evt_done', type: 'signing_request.completed', data: { signing_request: { id: 'req_123' } } };

    await post(body, signHeader(JSON.stringify(body))).expect(200, { ok: true, status: 'signed' });
    const contract = await Contract.findById(contractId);
    expect(contract?.status).toBe('signed');
    expect(contract?.signature?.status).toBe('completed');
    expect(contract?.signature?.pdfHash).toBe(crypto.createHash('sha256').update(pdf).digest('hex'));

    const replay = await post(body, signHeader(JSON.stringify(body)));
    expect(replay.status).toBe(200);
    expect(replay.body.idempotent).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('releases the event when the signed PDF cannot be fetched, so the retry can succeed', async () => {
    const download = jest.spyOn(firmaProvider, 'downloadFinalPdf').mockRejectedValueOnce(new Error('not ready'));
    const body = { id: 'evt_retry', type: 'signing_request.completed', data: { signing_request: { id: 'req_123' } } };

    await post(body, signHeader(JSON.stringify(body))).expect(500);
    expect((await Contract.findById(contractId))?.status).toBe('pending_signature');
    expect(await ProcessedEvent.countDocuments()).toBe(0);

    download.mockResolvedValueOnce(Buffer.from('%PDF-1.4'));
    await post(body, signHeader(JSON.stringify(body))).expect(200);
    expect((await Contract.findById(contractId))?.status).toBe('signed');
  });

  it('accepts legacy "signing" contracts', async () => {
    await Contract.updateOne({ _id: contractId }, { $set: { status: 'signing' } });
    jest.spyOn(firmaProvider, 'downloadFinalPdf').mockResolvedValue(Buffer.from('%PDF-1.4'));
    const body = { id: 'evt_legacy', type: 'signing_request.completed', data: { signing_request: { id: 'req_123' } } };
    await post(body, signHeader(JSON.stringify(body))).expect(200);
    expect((await Contract.findById(contractId))?.status).toBe('signed');
  });

  it('creates one envelope per contract and reuses it on later calls', async () => {
    await Contract.updateOne({ _id: contractId }, { $set: { status: 'draft' }, $unset: { signature: 1 } });
    jest.spyOn(User, 'findById').mockImplementation(((id: string) =>
      Promise.resolve({ _id: id, name: 'Ana Pérez', email: `${id}@example.com` })) as any);
    const create = jest.spyOn(firmaProvider, 'createSignatureFlow').mockResolvedValue({
      requestId: 'req_new',
      signerLinks: { owner: 'https://app.firma.dev/signing/o', tenant: 'https://app.firma.dev/signing/t' },
    });

    const first = await ensureFirmaSignature(await Contract.findById(contractId));
    expect(first).toMatchObject({ envelopeId: 'req_new', created: true });
    const saved = await Contract.findById(contractId);
    expect(saved?.status).toBe('pending_signature');
    expect(saved?.signature?.recipientUrls?.tenantUrl).toBe('https://app.firma.dev/signing/t');

    const second = await ensureFirmaSignature(saved);
    expect(second).toMatchObject({ envelopeId: 'req_new', created: false });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
