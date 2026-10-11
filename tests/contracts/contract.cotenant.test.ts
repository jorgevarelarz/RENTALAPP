import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { rentPeriodOf } from '../../src/utils/rentPeriod';
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
  sendCoTenantInviteEmail: jest.fn().mockResolvedValue(undefined),
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

    // Un operador de Mongo en la query se rechaza antes de llegar al controlador.
    const injected = await as(coId, '?include=cotenant&status[$ne]=x');
    expect(injected.status).toBe(400);
    expect(injected.body.error).toBe('invalid_input');
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
      .post(`/api/contracts/${contract._id}/payments/${rentPeriodOf(new Date())}/pay`)
      .set('x-user-id', tenantId)
      .set('x-user-role', 'tenant')
      .set('x-user-verified', 'true')
      .send();
    expect(r1.status).toBe(200);
    expect(r1.body.status).toBe('PROCESSING');

    const r2 = await request(app)
      .post(`/api/contracts/${contract._id}/payments/${rentPeriodOf(new Date())}/pay`)
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
    const { sendCoTenantInviteEmail } = jest.requireMock('../../src/utils/email');
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

      const [to, invite] = sendCoTenantInviteEmail.mock.calls.at(-1);
      expect(to).toBe('co@test.com');
      expect(invite).toMatchObject({ inviterName: 'tenant-9021', propertyTitle: 'Piso Test', propertyAddress: 'Calle 1, Madrid' });
      const match = String(invite.link).match(/^https:\/\/app\.example\.test\/invites\/accept\?token=([a-f0-9]{64})$/);
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
  describe('resend invite', () => {
    const tenantId = '507f1f77bcf86cd799439091';
    const landlordId = '507f1f77bcf86cd799439092';
    const asTenant = (req: request.Test, id = tenantId) =>
      req.set('x-user-id', id).set('x-user-role', 'tenant').set('x-user-verified', 'true');

    const setup = async (inviteExpiresAt: Date, updatedAt?: Date) => {
      await makeUser(tenantId, 'tenant', 'main9@test.com');
      await makeUser(landlordId, 'landlord', 'owner9@test.com');
      const property = await makeProperty(landlordId);
      const contract = await makeContract(landlordId, tenantId, String(property._id));
      const party = await ContractParty.create({
        contractId: contract._id,
        role: 'TENANT',
        email: 'co9@test.com',
        status: 'INVITED',
        invitedByUserId: new mongoose.Types.ObjectId(tenantId),
        inviteTokenHash: crypto.createHash('sha256').update('old-token').digest('hex'),
        inviteExpiresAt,
      });
      if (updatedAt) {
        await ContractParty.collection.updateOne({ _id: party._id }, { $set: { updatedAt } });
      }
      return { contract, party };
    };

    it('reissues an expired invite with a new link, invalidates the old one and lists the expiry', async () => {
      const { sendCoTenantInviteEmail } = jest.requireMock('../../src/utils/email');
      sendCoTenantInviteEmail.mockClear();
      const { contract, party } = await setup(new Date(Date.now() - 1000));

      const parties = await asTenant(request(app).get(`/api/contracts/${contract._id}/parties`));
      expect(parties.status).toBe(200);
      const invited = parties.body.items.find((p: any) => String(p.partyId) === String(party._id));
      expect(invited).toMatchObject({ status: 'INVITED', expired: true });

      const res = await asTenant(request(app).post(`/api/contracts/${contract._id}/tenants/${party._id}/resend`));
      expect(res.status).toBe(200);
      expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 47 * 60 * 60 * 1000);
      expect(sendCoTenantInviteEmail).toHaveBeenCalledTimes(1);
      const [to, invite] = sendCoTenantInviteEmail.mock.calls[0];
      expect(to).toBe('co9@test.com');
      const token = String(invite.link).split('token=')[1];

      expect((await request(app).get('/api/invites/preview').query({ token: 'old-token' })).status).toBe(404);
      const preview = await request(app).get('/api/invites/preview').query({ token });
      expect(preview.status).toBe(200);
      expect(preview.body.expired).toBe(false);
    });

    it('reports a failed invite email and lets the tenant resend it at once', async () => {
      const { sendCoTenantInviteEmail } = jest.requireMock('../../src/utils/email');
      await makeUser(tenantId, 'tenant', 'main9@test.com');
      await makeUser(landlordId, 'landlord', 'owner9@test.com');
      const property = await makeProperty(landlordId);
      const contract = await makeContract(landlordId, tenantId, String(property._id));

      sendCoTenantInviteEmail.mockResolvedValueOnce('failed');
      const invited = await asTenant(request(app).post(`/api/contracts/${contract._id}/tenants/invite`)).send({ email: 'co9@test.com' });
      expect(invited.status).toBe(200);
      expect(invited.body.emailStatus).toBe('failed');

      const parties = await asTenant(request(app).get(`/api/contracts/${contract._id}/parties`));
      const pending = parties.body.items.find((p: any) => String(p.partyId) === String(invited.body.partyId));
      expect(pending).toMatchObject({ status: 'INVITED', expired: false, emailFailed: true });

      // Sin la espera de 10 minutos: el invitado no ha recibido nada.
      sendCoTenantInviteEmail.mockResolvedValueOnce('sent');
      const url = `/api/contracts/${contract._id}/tenants/${invited.body.partyId}/resend`;
      const resent = await asTenant(request(app).post(url));
      expect(resent.status).toBe(200);
      expect(resent.body.emailStatus).toBe('sent');
      const after = await asTenant(request(app).get(`/api/contracts/${contract._id}/parties`));
      expect(after.body.items.find((p: any) => String(p.partyId) === String(invited.body.partyId)).emailFailed).toBe(false);
      // Ahora que salió, vuelve la espera.
      expect((await asTenant(request(app).post(url))).status).toBe(429);
    });

    it('limits resending a still valid invite to once every 10 minutes', async () => {
      const valid = new Date(Date.now() + 60 * 60 * 1000);
      const { contract, party } = await setup(valid);
      const url = `/api/contracts/${contract._id}/tenants/${party._id}/resend`;
      const tooSoon = await asTenant(request(app).post(url));
      expect(tooSoon.status).toBe(429);
      expect(tooSoon.body.error).toBe('resend_too_soon');

      await ContractParty.collection.updateOne(
        { _id: party._id },
        { $set: { updatedAt: new Date(Date.now() - 11 * 60 * 1000) } },
      );
      expect((await asTenant(request(app).post(url))).status).toBe(200);
    });

    it('only lets the principal tenant resend, and only pending invites of that contract', async () => {
      const { contract, party } = await setup(new Date(Date.now() - 1000));
      const otherId = '507f1f77bcf86cd799439093';
      await makeUser(otherId, 'tenant', 'other9@test.com');
      const url = `/api/contracts/${contract._id}/tenants/${party._id}/resend`;
      expect((await asTenant(request(app).post(url), otherId)).status).toBe(403);
      expect(
        (await asTenant(request(app).post(`/api/contracts/${contract._id}/tenants/507f1f77bcf86cd799439099/resend`))).status,
      ).toBe(404);
      expect((await asTenant(request(app).post(`/api/contracts/${contract._id}/tenants/nope/resend`))).status).toBe(404);

      await ContractParty.updateOne({ _id: party._id }, { status: 'JOINED' });
      const joined = await asTenant(request(app).post(url));
      expect(joined.status).toBe(400);
      expect(joined.body.error).toBe('not_invited');
    });
  });

  describe('cancel invite', () => {
    const tenantId = '507f1f77bcf86cd7994390a1';
    const landlordId = '507f1f77bcf86cd7994390a2';
    const asTenant = (req: request.Test, id = tenantId) =>
      req.set('x-user-id', id).set('x-user-role', 'tenant').set('x-user-verified', 'true');

    const setup = async () => {
      await makeUser(tenantId, 'tenant', 'main10@test.com');
      await makeUser(landlordId, 'landlord', 'owner10@test.com');
      const property = await makeProperty(landlordId);
      const contract = await makeContract(landlordId, tenantId, String(property._id));
      const party = await ContractParty.create({
        contractId: contract._id,
        role: 'TENANT',
        email: 'co10@test.com',
        status: 'INVITED',
        invitedByUserId: new mongoose.Types.ObjectId(tenantId),
        inviteTokenHash: crypto.createHash('sha256').update('cancel-token').digest('hex'),
        inviteExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      return { contract, party };
    };

    it('invalidates the link, hides the invite and lets the tenant invite the same email again', async () => {
      const { contract, party } = await setup();
      const res = await asTenant(request(app).post(`/api/contracts/${contract._id}/tenants/${party._id}/cancel`));
      expect(res.status).toBe(200);

      const stored = await ContractParty.findById(party._id).lean();
      expect(stored).toMatchObject({ status: 'REMOVED' });
      expect(stored?.inviteTokenHash).toBeUndefined();
      expect((await request(app).get('/api/invites/preview').query({ token: 'cancel-token' })).status).toBe(404);

      const again = await asTenant(request(app).post(`/api/contracts/${contract._id}/tenants/invite`)).send({ email: 'co10@test.com' });
      expect(again.status).toBe(200);
      expect(String(again.body.partyId)).toBe(String(party._id));
    });

    it('only lets the principal tenant cancel, and only pending invites of that contract', async () => {
      const { contract, party } = await setup();
      const otherId = '507f1f77bcf86cd7994390a3';
      await makeUser(otherId, 'tenant', 'other10@test.com');
      const url = `/api/contracts/${contract._id}/tenants/${party._id}/cancel`;
      expect((await asTenant(request(app).post(url), otherId)).status).toBe(403);
      expect(
        (await request(app).post(url).set('x-user-id', landlordId).set('x-user-role', 'landlord').set('x-user-verified', 'true')).status,
      ).toBe(403);
      expect((await asTenant(request(app).post(`/api/contracts/${contract._id}/tenants/nope/cancel`))).status).toBe(404);

      const other = await ContractParty.create({ contractId: new mongoose.Types.ObjectId(), role: 'TENANT', email: 'x@test.com', status: 'INVITED' });
      expect((await asTenant(request(app).post(`/api/contracts/${contract._id}/tenants/${other._id}/cancel`))).status).toBe(404);

      await ContractParty.updateOne({ _id: party._id }, { status: 'JOINED' });
      const joined = await asTenant(request(app).post(url));
      expect(joined.status).toBe(400);
      expect(joined.body.error).toBe('not_invited');
      expect((await ContractParty.findById(party._id).lean())?.status).toBe('JOINED');
    });
  });
});
