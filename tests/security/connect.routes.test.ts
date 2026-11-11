import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import { stripe } from '../../src/utils/stripe';

describe('Cuenta de cobros (Stripe Connect)', () => {
  const landlordId = '507f1f77bcf86cd799439e01';
  const agencyId = '507f1f77bcf86cd799439e02';
  const as = (id: string, role: string) => ({ 'x-user-id': id, 'x-user-role': role, 'x-user-verified': 'true' });
  const saved = { ...process.env };

  beforeAll(connectDb);
  afterAll(async () => {
    process.env = saved;
    await disconnectDb();
  });

  beforeEach(async () => {
    process.env.PLATFORM_RENT_FEE_PCT = '5';
    process.env.PLATFORM_SIGN_FEE_PCT = '2';
    process.env.APP_URL = 'https://app.test';
    process.env.FRONTEND_URL = 'https://app.test';
    await User.create([
      { _id: new mongoose.Types.ObjectId(landlordId), name: 'Casera', email: 'casera-connect@test.com', passwordHash: 'h', role: 'landlord' },
      { _id: new mongoose.Types.ObjectId(agencyId), name: 'Agencia', email: 'agencia-connect@test.com', passwordHash: 'h', role: 'agency' },
    ]);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await clearDb();
  });

  it('sin cuenta conectada dice que no está lista y enseña las comisiones', async () => {
    const res = await request(app).get('/api/connect/owner/status').set(as(landlordId, 'landlord')).expect(200);
    expect(res.body).toEqual({ connected: false, ready: false, fees: { rentPct: 5, signPct: 2 } });
  });

  it('la cuenta está lista cuando puede recibir transferencias', async () => {
    await User.updateOne({ _id: landlordId }, { $set: { stripeAccountId: 'acct_c1' } });
    const retrieve = jest.spyOn(stripe.accounts, 'retrieve').mockResolvedValue({
      id: 'acct_c1',
      capabilities: { transfers: 'pending' },
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: true,
      requirements: { currently_due: ['individual.verification.document'], current_deadline: null, disabled_reason: null },
    } as any);
    const pending = await request(app).get('/api/connect/owner/status').set(as(landlordId, 'landlord')).expect(200);
    expect(pending.body).toMatchObject({ connected: true, ready: false });

    retrieve.mockResolvedValue({ id: 'acct_c1', capabilities: { transfers: 'active' }, payouts_enabled: true } as any);
    const ready = await request(app).get('/api/connect/owner/status').set(as(landlordId, 'landlord')).expect(200);
    expect(ready.body).toMatchObject({ connected: true, ready: true, payouts_enabled: true });
  });

  it('el alta crea la cuenta una vez y vuelve al panel de cada rol', async () => {
    const createAccount = jest.spyOn(stripe.accounts, 'create').mockResolvedValue({ id: 'acct_new' } as any);
    const createLink = jest
      .spyOn(stripe.accountLinks, 'create')
      .mockResolvedValue({ url: 'https://connect.stripe.com/setup/x' } as any);

    const first = await request(app).post('/api/connect/owner/link').set(as(landlordId, 'landlord')).expect(200);
    expect(first.body).toEqual({ accountId: 'acct_new', url: 'https://connect.stripe.com/setup/x' });
    expect(createAccount.mock.calls[0][0]).toMatchObject({ business_type: 'individual', country: 'ES' });
    expect(createLink.mock.calls[0][0]).toMatchObject({ return_url: 'https://app.test/connect/return?panel=landlord' });

    await request(app).post('/api/connect/owner/link').set(as(landlordId, 'landlord')).expect(200);
    expect(createAccount).toHaveBeenCalledTimes(1);

    createAccount.mockResolvedValue({ id: 'acct_agency' } as any);
    await request(app).post('/api/connect/owner/link').set(as(agencyId, 'agency')).expect(200);
    expect(createAccount.mock.calls[1][0]).not.toHaveProperty('business_type');
    expect(createLink.mock.calls[2][0]).toMatchObject({ return_url: 'https://app.test/connect/return?panel=agency' });
  });

  it('un fallo de Stripe da 502 con código fijo, sin el mensaje del proveedor', async () => {
    jest.spyOn(stripe.accounts, 'create').mockRejectedValue(new Error('No such platform: acct_secret'));
    const res = await request(app).post('/api/connect/owner/link').set(as(landlordId, 'landlord')).expect(502);
    expect(res.body).toEqual({ error: 'stripe_connect_failed' });
  });

  it('la vuelta de Stripe lleva a cada rol a su panel', async () => {
    const landlord = await request(app).get('/connect/return').expect(302);
    expect(landlord.headers.location).toBe('https://app.test/landlord/payments?connect=success');
    const agency = await request(app).get('/connect/refresh?panel=agency').expect(302);
    expect(agency.headers.location).toBe('https://app.test/agency?connect=retry');
    const other = await request(app).get('/connect/return?panel=//evil.com').expect(302);
    expect(other.headers.location).toBe('https://app.test/landlord/payments?connect=success');
  });
});
