import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';
import { User } from '../../src/models/user.model';

// Mock stripe client (no llamadas reales)
jest.mock('../../src/utils/stripe', () => {
  const create = jest.fn().mockResolvedValue({ id: 'pi_123', status: 'succeeded' });
  const list = jest.fn().mockResolvedValue({ data: [{ id: 'pm_123' }] });
  const retrieve = jest.fn().mockResolvedValue({ charges_enabled: true });
  return {
    stripe: {
      paymentIntents: { create },
      paymentMethods: { list },
      accounts: { retrieve },
    },
  };
});

describe('Pay rent with saved method', () => {
  beforeAll(async () => {
    process.env.ALLOW_POLICY_BYPASS = 'true';
    await connectDb();
  });
  afterAll(disconnectDb);
  afterEach(async () => {
    jest.clearAllMocks();
    await clearDb();
  });

  it('charges rent off-session using saved method', async () => {
    const landlord = await User.create({
      name: 'LL',
      email: 'll@test.local',
      passwordHash: 'x',
      role: 'landlord',
      stripeAccountId: 'acct_123',
    });
    const tenant = await User.create({
      name: 'TT',
      email: 'tt@test.local',
      passwordHash: 'x',
      role: 'tenant',
      stripeCustomerId: 'cus_123',
    });
    const contract = await Contract.create({
      landlord: landlord._id,
      tenant: tenant._id,
      property: '507f1f77bcf86cd799439013',
      rent: 700,
      rentAmount: 700,
      deposit: 700,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      region: 'general',
      clauses: [],
      status: 'signed',
    });

    const res = await request(app)
      .post(`/api/contracts/${contract._id}/pay-rent-saved`)
      .set('x-user-role', 'tenant')
      .set('x-user-id', String(tenant._id))
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('succeeded');
  });

  it('returns 400 if tenant has no saved method', async () => {
    const landlord = await User.create({
      name: 'LL',
      email: 'll@test.local',
      passwordHash: 'x',
      role: 'landlord',
      stripeAccountId: 'acct_123',
    });
    const tenant = await User.create({
      name: 'TT',
      email: 'tt@test.local',
      passwordHash: 'x',
      role: 'tenant',
      stripeCustomerId: null,
    });
    const contract = await Contract.create({
      landlord: landlord._id,
      tenant: tenant._id,
      property: '507f1f77bcf86cd799439013',
      rent: 700,
      deposit: 700,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      region: 'general',
      clauses: [],
      status: 'signed',
    });

    await request(app)
      .post(`/api/contracts/${contract._id}/pay-rent-saved`)
      .set('x-user-role', 'tenant')
      .set('x-user-id', String(tenant._id))
      .expect(400);
  });
});

