import request from 'supertest';
import { app } from '../../src/app';
import mongoose from 'mongoose';
import { Contract } from '../../src/models/contract.model';
import { User } from '../../src/models/user.model';
import { Property } from '../../src/models/property.model';

jest.mock('../../src/core/signature/docusign.provider', () => ({
  __esModule: true,
  createEnvelope: jest.fn(async () => ({ envelopeId: 'env_test_123', status: 'sent' })),
  fetchCompletedDocument: jest.fn(async () => Buffer.from('%PDF-signed%')),
  verifyConnectHmac: jest.fn((raw: any, sig: string) => sig === 'valid')
}));

describe('DocuSign signature flow (mocked provider)', () => {
  const landlord = new mongoose.Types.ObjectId().toString();
  const tenant = new mongoose.Types.ObjectId().toString();
  let id = '';
  const prevSignProvider = process.env.SIGN_PROVIDER;
  beforeAll(async () => {
    process.env.SIGN_PROVIDER = 'docusign';
    // Create minimal users
    await User.create({ _id: landlord, name: 'Landlord', email: 'l@test.com', passwordHash: 'x', role: 'landlord' } as any);
    await User.create({ _id: tenant, name: 'Tenant', email: 't@test.com', passwordHash: 'x', role: 'tenant' } as any);
    const prop = await Property.create({
      owner: landlord,
      title: 'Piso prueba',
      address: 'C/ Mayor 1',
      region: 'galicia',
      city: 'A Coruña',
      location: { type: 'Point', coordinates: [-8.41, 43.36] },
      price: 700,
      deposit: 700,
      sizeM2: 60,
      rooms: 2,
      bathrooms: 1,
      furnished: false,
      petsAllowed: false,
      availableFrom: new Date(),
      images: [],
      status: 'active',
    } as any);
    const c = await Contract.create({
      landlord,
      tenant,
      property: prop._id,
      rent: 700,
      deposit: 700,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      region: 'galicia',
      status: 'draft',
      clauses: [],
    } as any);
    id = c.id;
  });
  afterAll(() => {
    if (prevSignProvider === undefined) delete process.env.SIGN_PROVIDER;
    else process.env.SIGN_PROVIDER = prevSignProvider;
  });

  it('starts signature and stores envelopeId/status', async () => {
    const r = await request(app)
      .post(`/api/contracts/${id}/signature`)
      .set('x-user-id', landlord)
      .set('x-user-role', 'landlord')
      .send();
    expect(r.status).toBe(200);
    expect(r.body.envelopeId).toBe('env_test_123');
    const updated = await Contract.findById(id).lean();
    expect(updated?.signature?.envelopeId).toBe('env_test_123');
    expect(updated?.signature?.status).toBe('sent');
  });

  it('processes callback completed with valid HMAC and saves signed PDF', async () => {
    const body = { envelopeId: 'env_test_123', event: 'completed' } as any;
    const cb = await request(app)
      .post(`/api/contracts/${id}/signature/callback`)
      .set('X-DocuSign-Signature-1', 'valid')
      .send(body);
    expect(cb.status).toBe(200);
    const updated = await Contract.findById(id).lean();
    expect(updated?.signature?.status).toBe('completed');
    expect(updated?.signature?.pdfUrl).toBe(`/api/contracts/${id}/pdf/signed`);
    expect(typeof updated?.signature?.pdfHash).toBe('string');
  });

  it('rejects invalid HMAC', async () => {
    const body = { envelopeId: 'env_test_123', event: 'completed' } as any;
    const cb = await request(app)
      .post(`/api/contracts/${id}/signature/callback`)
      .set('X-DocuSign-Signature-1', 'invalid')
      .send(body);
    expect(cb.status).toBe(400);
  });
});
