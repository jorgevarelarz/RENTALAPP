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
});
