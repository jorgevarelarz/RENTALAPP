import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import { Property } from '../../src/models/property.model';
import { Contract } from '../../src/models/contract.model';
import { ContractParty } from '../../src/models/contractParty.model';
import crypto from 'crypto';

jest.mock('../../src/utils/payment', () => ({
  createPaymentIntent: jest.fn().mockResolvedValue({ id: 'pi_test_1', client_secret: 'secret_1' }),
  encryptIBAN: jest.fn(),
  decryptIBAN: jest.fn(),
  createCustomerAndMandate: jest.fn(),
}));

jest.mock('../../src/utils/email', () => ({
  ...jest.requireActual('../../src/utils/email'),
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

describe('Co-tenants flows', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  const makeUser = async (id: string, role: string, email: string) => {
    await User.create({
      _id: new mongoose.Types.ObjectId(id),
      name: `${role}-${id.slice(-4)}`,
      email,
      passwordHash: 'hash',
      role,
    });
  };

  const makeProperty = async (ownerId: string) => {
    return Property.create({
      owner: new mongoose.Types.ObjectId(ownerId),
      title: 'Piso Test',
      description: 'desc',
      address: 'Calle 1',
      region: 'madrid',
      city: 'Madrid',
      location: { type: 'Point', coordinates: [0, 0] },
      price: 900,
      deposit: 900,
      availableFrom: new Date(),
      images: [],
      status: 'active',
    });
  };

  const makeContract = async (landlordId: string, tenantId: string, propertyId: string) => {
    return Contract.create({
      landlord: new mongoose.Types.ObjectId(landlordId),
      tenant: new mongoose.Types.ObjectId(tenantId),
      property: new mongoose.Types.ObjectId(propertyId),
      rent: 900,
      deposit: 900,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      region: 'madrid',
      status: 'active',
      signedByTenant: true,
      signedByLandlord: true,
      stripeCustomerId: 'cus_test_1',
    });
  };

  it('rejects invite accept if logged user email does not match', async () => {
    const tenantId = '507f1f77bcf86cd799439011';
    const otherId = '507f1f77bcf86cd799439012';
    const landlordId = '507f1f77bcf86cd799439013';
    await makeUser(tenantId, 'tenant', 'tenant@test.com');
    await makeUser(otherId, 'tenant', 'other@test.com');
    await makeUser(landlordId, 'landlord', 'landlord@test.com');
    const property = await makeProperty(landlordId);
    const contract = await makeContract(landlordId, tenantId, String(property._id));
    const token = 'invite-token';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await ContractParty.create({
      contractId: contract._id,
      role: 'TENANT',
      email: 'tenant@test.com',
      status: 'INVITED',
      inviteTokenHash: tokenHash,
      inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    const res = await request(app)
      .post('/api/invites/accept')
      .set('x-user-id', otherId)
      .set('x-user-role', 'tenant')
      .set('x-user-verified', 'true')
      .send({ token });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('email_mismatch');
  });

  it('accepts invite for matching user', async () => {
    const tenantId = '507f1f77bcf86cd799439021';
    const landlordId = '507f1f77bcf86cd799439022';
    await makeUser(tenantId, 'tenant', 'tenant2@test.com');
    await makeUser(landlordId, 'landlord', 'landlord2@test.com');
    const property = await makeProperty(landlordId);
    const contract = await makeContract(landlordId, tenantId, String(property._id));
    const token = 'invite-token-2';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await ContractParty.create({
      contractId: contract._id,
      role: 'TENANT',
      email: 'tenant2@test.com',
      status: 'INVITED',
      inviteTokenHash: tokenHash,
      inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    const res = await request(app)
      .post('/api/invites/accept')
      .set('x-user-id', tenantId)
      .set('x-user-role', 'tenant')
      .set('x-user-verified', 'true')
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('lists co-tenant contracts only with include=cotenant and marks myRole', async () => {
    const tenantId = '507f1f77bcf86cd799439081';
    const coId = '507f1f77bcf86cd799439082';
    const landlordId = '507f1f77bcf86cd799439083';
    const invitedId = '507f1f77bcf86cd799439084';
    await makeUser(tenantId, 'tenant', 'main8@test.com');
    await makeUser(coId, 'tenant', 'co8@test.com');
    await makeUser(landlordId, 'landlord', 'landlord8@test.com');
    await makeUser(invitedId, 'tenant', 'invited8@test.com');
    const property = await makeProperty(landlordId);
    const contract = await makeContract(landlordId, tenantId, String(property._id));
    await ContractParty.create({ contractId: contract._id, role: 'TENANT', email: 'co8@test.com', status: 'JOINED', userId: new mongoose.Types.ObjectId(coId) });
    await ContractParty.create({ contractId: contract._id, role: 'TENANT', email: 'invited8@test.com', status: 'INVITED', userId: new mongoose.Types.ObjectId(invitedId) });

    const as = (id: string, query = '') =>
      request(app)
        .get(`/api/contracts${query}`)
        .set('x-user-id', id)
        .set('x-user-role', 'tenant')
        .set('x-user-verified', 'true');

    const plain = await as(coId);
    expect(plain.status).toBe(200);
    expect(plain.body.items).toHaveLength(0);

    const withCo = await as(coId, '?include=cotenant');
    expect(withCo.status).toBe(200);
    expect(withCo.body.items).toHaveLength(1);
    expect(withCo.body.items[0].myRole).toBe('cotenant');
    expect(withCo.body.items[0].ibanEncrypted).toBeUndefined();

    // Una invitación sin aceptar no da acceso al contrato.
    const invited = await as(invitedId, '?include=cotenant');
    expect(invited.body.items).toHaveLength(0);

    const main = await as(tenantId, '?include=cotenant');
    expect(main.body.items).toHaveLength(1);
    expect(main.body.items[0].myRole).toBe('tenant');

    // `status` como objeto ya no llega a Mongo como operador.
    const injected = await as(coId, '?include=cotenant&status[$ne]=x');
    expect(injected.status).toBe(200);
    expect(injected.body.items).toHaveLength(1);
  });

  it('prevents double pay for same period (idempotent)', async () => {
    const tenantId = '507f1f77bcf86cd799439031';
    const landlordId = '507f1f77bcf86cd799439032';
    await makeUser(tenantId, 'tenant', 'tenant3@test.com');
    await makeUser(landlordId, 'landlord', 'landlord3@test.com');
    const property = await makeProperty(landlordId);
    const contract = await makeContract(landlordId, tenantId, String(property._id));
    await ContractParty.create({
      contractId: contract._id,
      role: 'TENANT',
      userId: new mongoose.Types.ObjectId(tenantId),
      email: 'tenant3@test.com',
      status: 'SIGNED',
    });

    const r1 = await request(app)
      .post(`/api/contracts/${contract._id}/payments/2026-01/pay`)
      .set('x-user-id', tenantId)
      .set('x-user-role', 'tenant')
      .set('x-user-verified', 'true')
      .send();
    expect(r1.status).toBe(200);
    expect(r1.body.status).toBe('PROCESSING');

    const r2 = await request(app)
      .post(`/api/contracts/${contract._id}/payments/2026-01/pay`)
      .set('x-user-id', tenantId)
      .set('x-user-role', 'tenant')
      .set('x-user-verified', 'true')
      .send();
    expect(r2.status).toBe(200);
    expect(r2.body.status).toBe('PROCESSING');
  });

  it('rejects invalid period format', async () => {
    const tenantId = '507f1f77bcf86cd799439041';
    const landlordId = '507f1f77bcf86cd799439042';
    await makeUser(tenantId, 'tenant', 'tenant4@test.com');
    await makeUser(landlordId, 'landlord', 'landlord4@test.com');
    const property = await makeProperty(landlordId);
    const contract = await makeContract(landlordId, tenantId, String(property._id));
    await ContractParty.create({
      contractId: contract._id,
      role: 'TENANT',
      userId: new mongoose.Types.ObjectId(tenantId),
      email: 'tenant4@test.com',
      status: 'SIGNED',
    });

    const res = await request(app)
      .post(`/api/contracts/${contract._id}/payments/2026-13/pay`)
      .set('x-user-id', tenantId)
      .set('x-user-role', 'tenant')
      .set('x-user-verified', 'true')
      .send();
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_period');
  });

  it('redacts emails for non-landlord/non-party', async () => {
    const tenantId = '507f1f77bcf86cd799439051';
    const landlordId = '507f1f77bcf86cd799439052';
    const adminId = '507f1f77bcf86cd799439053';
    await makeUser(tenantId, 'tenant', 'tenant5@test.com');
    await makeUser(landlordId, 'landlord', 'landlord5@test.com');
    await makeUser(adminId, 'admin', 'admin@test.com');
    const property = await makeProperty(landlordId);
    const contract = await makeContract(landlordId, tenantId, String(property._id));
    await ContractParty.create({
      contractId: contract._id,
      role: 'TENANT',
      userId: new mongoose.Types.ObjectId(tenantId),
      email: 'tenant5@test.com',
      status: 'SIGNED',
    });

    const res = await request(app)
      .get(`/api/contracts/${contract._id}/parties`)
      .set('x-user-id', adminId)
      .set('x-user-role', 'admin')
      .set('x-user-verified', 'true');
    expect(res.status).toBe(200);
    expect(res.body.items[0].email).not.toBe('tenant5@test.com');
  });

  it('sends the invite link to the configured frontend with a token that is stored only as a hash', async () => {
    const { sendEmail } = jest.requireMock('../../src/utils/email');
    const prevFrontend = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://app.example.test/';
    try {
      const tenantId = '507f1f77bcf86cd799439021';
      const landlordId = '507f1f77bcf86cd799439023';
      await makeUser(tenantId, 'tenant', 'main@test.com');
      await makeUser(landlordId, 'landlord', 'owner@test.com');
      const property = await makeProperty(landlordId);
      const contract = await makeContract(landlordId, tenantId, String(property._id));

      const res = await request(app)
        .post(`/api/contracts/${contract._id}/tenants/invite`)
        .set('x-user-id', tenantId)
        .set('x-user-role', 'tenant')
        .set('x-user-verified', 'true')
        .send({ email: 'Co@Test.com ' });
      expect(res.status).toBe(200);

      const html: string = sendEmail.mock.calls.at(-1)[2];
      const match = html.match(/href="https:\/\/app\.example\.test\/invites\/accept\?token=([a-f0-9]{64})"/);
      expect(match).not.toBeNull();
      const party = await ContractParty.findById(res.body.partyId).lean();
      expect(party?.email).toBe('co@test.com');
      expect(party?.inviteTokenHash).toBe(crypto.createHash('sha256').update(match![1]).digest('hex'));
    } finally {
      if (prevFrontend === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = prevFrontend;
    }
  });
  it('shows a public preview of the invite and lets the joined co-tenant read the contract', async () => {
    const tenantId = '507f1f77bcf86cd799439061';
    const coId = '507f1f77bcf86cd799439062';
    const landlordId = '507f1f77bcf86cd799439063';
    await makeUser(tenantId, 'tenant', 'main6@test.com');
    await makeUser(coId, 'tenant', 'co6@test.com');
    await makeUser(landlordId, 'landlord', 'owner6@test.com');
    const property = await makeProperty(landlordId);
    const contract = await makeContract(landlordId, tenantId, String(property._id));
    const token = 'invite-token-6';
    await ContractParty.create({
      contractId: contract._id,
      role: 'TENANT',
      email: 'co6@test.com',
      status: 'INVITED',
      invitedByUserId: new mongoose.Types.ObjectId(tenantId),
      inviteTokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      inviteExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });
    const asCo = (req: request.Test) =>
      req.set('x-user-id', coId).set('x-user-role', 'tenant').set('x-user-verified', 'true');

    expect((await request(app).get('/api/invites/preview')).status).toBe(400);
    expect((await request(app).get('/api/invites/preview').query({ token: 'otro' })).status).toBe(404);
    const preview = await request(app).get('/api/invites/preview').query({ token });
    expect(preview.status).toBe(200);
    expect(preview.body).toEqual({
      email: 'co6@test.com',
      expired: false,
      inviterName: `tenant-${tenantId.slice(-4)}`,
      property: { title: 'Piso Test', address: 'Calle 1', city: 'Madrid' },
    });

    expect((await asCo(request(app).get(`/api/contracts/${contract._id}`))).status).toBe(403);
    expect((await asCo(request(app).get(`/api/contracts/${contract._id}/pdf`))).status).toBe(403);

    const accepted = await asCo(request(app).post('/api/invites/accept')).send({ token });
    expect(accepted.status).toBe(200);
    expect(String(accepted.body.contractId)).toBe(String(contract._id));

    const detail = await asCo(request(app).get(`/api/contracts/${contract._id}`));
    expect(detail.status).toBe(200);
    expect(detail.body.ibanEncrypted).toBeUndefined();
    expect((await asCo(request(app).get(`/api/contracts/${contract._id}/pdf`))).status).toBe(200);
    // La invitación ya usada no se puede volver a previsualizar.
    expect((await request(app).get('/api/invites/preview').query({ token })).status).toBe(404);
  });
});
