import request from 'supertest';
import crypto from 'crypto';
import { app } from '../../src/app';
import { Contract } from '../../src/models/contract.model';
import { ProcessedEvent } from '../../src/models/processedEvent.model';
import { User } from '../../src/models/user.model';
import * as firma from '../../src/signature/firma';
import { firmaProvider, verifyFirmaSignature } from '../../src/signature/firma';
import { ensureFirmaSignature, initSignature } from '../../src/services/signature.service';
import { ContractSignatureEvent } from '../../src/models/contractSignatureEvent.model';
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
  const LANDLORD = '507f1f77bcf86cd799439011';
  const TENANT = '507f1f77bcf86cd799439012';
  const mockParties = () =>
    jest.spyOn(User, 'findById').mockImplementation(((id: string) =>
      Promise.resolve({ _id: id, name: 'Ana Pérez', email: `${id}@example.com` })) as any);
  const mockCreate = (links = { owner: 'https://app.firma.dev/signing/o', tenant: 'https://app.firma.dev/signing/t' }) =>
    jest.spyOn(firmaProvider, 'createSignatureFlow').mockResolvedValue({ requestId: 'req_new', signerLinks: links as any });
  const resetToDraft = (status = 'draft') =>
    Contract.updateOne({ _id: contractId }, { $set: { status }, $unset: { signature: 1 } });

  it('only lets the contract landlord (or an admin) start signing, and only returns their own link', async () => {
    await resetToDraft();
    mockParties();
    const create = mockCreate();

    await expect(initSignature(contractId, { id: '507f1f77bcf86cd799439099', role: 'landlord' }))
      .rejects.toMatchObject({ status: 403 });
    expect(create).not.toHaveBeenCalled();

    const landlord = await initSignature(contractId, { id: LANDLORD, role: 'landlord' });
    expect(landlord.recipientUrls).toEqual({ landlordUrl: 'https://app.firma.dev/signing/o' });
    const admin = await initSignature(contractId, { id: '507f1f77bcf86cd799439098', role: 'admin' });
    expect(admin.recipientUrls).toEqual({});
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('refuses to create a new envelope for an already signed contract', async () => {
    await Contract.updateOne({ _id: contractId }, { $set: { status: 'signed', 'signature.status': 'completed' } });
    const create = mockCreate();
    await expect(ensureFirmaSignature(await Contract.findById(contractId)))
      .rejects.toMatchObject({ status: 409, message: 'contract_already_signed' });
    expect(create).not.toHaveBeenCalled();
    expect((await Contract.findById(contractId))?.signature?.envelopeId).toBe('req_123');
  });

  it('does not create a second envelope while another request holds the lock', async () => {
    await resetToDraft();
    await Contract.updateOne({ _id: contractId }, { $set: { 'signature.lockedAt': new Date() } });
    mockParties();
    const create = mockCreate();
    await expect(ensureFirmaSignature(await Contract.findById(contractId)))
      .rejects.toMatchObject({ status: 409, message: 'signature_in_progress' });
    expect(create).not.toHaveBeenCalled();
  });

  it('releases the lock and promotes legacy "generated" contracts', async () => {
    await resetToDraft('generated');
    mockParties();
    mockCreate();
    await ensureFirmaSignature(await Contract.findById(contractId));
    const saved = await Contract.findById(contractId).lean();
    expect(saved?.status).toBe('pending_signature');
    expect((saved?.signature as any)?.lockedAt).toBeUndefined();
  });

  it('repairs a missing signer link on the next call instead of reusing it empty', async () => {
    await resetToDraft();
    mockParties();
    const create = mockCreate({ owner: 'https://app.firma.dev/signing/o' } as any);
    await ensureFirmaSignature(await Contract.findById(contractId));
    expect((await Contract.findById(contractId))?.signature?.recipientUrls?.tenantUrl).toBeUndefined();

    const links = jest.spyOn(firma, 'fetchFirmaSignerLinks').mockResolvedValue({ tenant: 'https://app.firma.dev/signing/t' });
    const again = await ensureFirmaSignature(await Contract.findById(contractId));
    expect(again.recipientUrls.tenantUrl).toBe('https://app.firma.dev/signing/t');
    expect(links).toHaveBeenCalledWith('req_new', expect.any(Array));
    expect(create).toHaveBeenCalledTimes(1);
    expect((await Contract.findById(contractId))?.signature?.recipientUrls?.tenantUrl).toBe('https://app.firma.dev/signing/t');
  });

  it('keeps a completed signature when a late non-final event arrives', async () => {
    jest.spyOn(firmaProvider, 'downloadFinalPdf').mockResolvedValue(Buffer.from('%PDF-1.4'));
    const done = { id: 'evt_done2', type: 'signing_request.completed', data: { signing_request: { id: 'req_123' } } };
    await post(done, signHeader(JSON.stringify(done))).expect(200);
    const late = { id: 'evt_late', type: 'signing_request.viewed', data: { signing_request: { id: 'req_123' } } };
    await post(late, signHeader(JSON.stringify(late))).expect(200);
    const contract = await Contract.findById(contractId);
    expect(contract?.signature?.status).toBe('completed');
    expect(contract?.status).toBe('signed');
  });

  it('writes the audit event once even when the first delivery fails', async () => {
    const download = jest.spyOn(firmaProvider, 'downloadFinalPdf').mockRejectedValueOnce(new Error('not ready'));
    const body = { id: 'evt_audit', type: 'signing_request.completed', data: { signing_request: { id: 'req_123' } } };
    await post(body, signHeader(JSON.stringify(body))).expect(500);
    expect(await ContractSignatureEvent.countDocuments({ contractId })).toBe(0);
    download.mockResolvedValueOnce(Buffer.from('%PDF-1.4'));
    await post(body, signHeader(JSON.stringify(body))).expect(200);
    expect(await ContractSignatureEvent.countDocuments({ contractId })).toBe(1);
  });

  it('answers 500 and releases the event when the database fails mid-processing', async () => {
    jest.spyOn(Contract, 'findByIdAndUpdate').mockRejectedValueOnce(new Error('mongo timeout') as never);
    const body = { id: 'evt_dbfail', type: 'signing_request.viewed', data: { signing_request: { id: 'req_123' } } };
    await post(body, signHeader(JSON.stringify(body))).expect(500);
    expect(await ProcessedEvent.countDocuments({ eventId: 'evt_dbfail' })).toBe(0);
  });
});
