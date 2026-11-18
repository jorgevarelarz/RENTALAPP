import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { connectLandlord } from '../utils/connect';
import { User } from '../../src/models/user.model';
import { Contract } from '../../src/models/contract.model';
import { RentPayment } from '../../src/models/rentPayment.model';
import { Payment } from '../../src/models/payment.model';
import { stripe } from '../../src/utils/stripe';
import { stripe as paymentStripe } from '../../src/utils/payment';
import { rentPeriodOf } from '../../src/utils/rentPeriod';

// P1 de la auditoría: la renta se cobraba en la cuenta de la plataforma y nunca llegaba al propietario.
describe('Reparto del cobro de renta', () => {
  const tenantId = '507f1f77bcf86cd799439b01';
  const landlordId = '507f1f77bcf86cd799439b02';
  const asTenant = { 'x-user-id': tenantId, 'x-user-role': 'tenant', 'x-user-verified': 'true' };
  const saved = { ...process.env };

  let createIntent: jest.SpyInstance;
  // utils/payment tiene su propio cliente Stripe (lo usa el pago por periodo).
  let createPeriodIntent: jest.SpyInstance;
  let intentSeq = 0;

  beforeAll(async () => {
    await connectDb();
    await Promise.all([RentPayment.init(), Payment.init()]);
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_split';
  });
  afterAll(async () => {
    process.env = saved;
    await disconnectDb();
  });

  beforeEach(async () => {
    intentSeq = 0;
    process.env.PLATFORM_RENT_FEE_PCT = '5';
    process.env.PLATFORM_MIN_RENT_FEE_CENTS = '0';
    process.env.PLATFORM_SIGN_FEE_PCT = '2';
    await User.create({
      _id: new mongoose.Types.ObjectId(tenantId),
      name: 'Inquilina',
      email: 'inquilina-split@test.com',
      passwordHash: 'hash',
      role: 'tenant',
    });
    createIntent = jest.spyOn(stripe.paymentIntents, 'create').mockImplementation((async () => {
      intentSeq += 1;
      return { id: `pi_split_${intentSeq}`, client_secret: `pi_split_${intentSeq}_secret`, status: 'requires_payment_method' };
    }) as any);
    createPeriodIntent = jest
      .spyOn(paymentStripe.paymentIntents, 'create')
      .mockImplementation(createIntent.getMockImplementation() as any);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await clearDb();
  });

  const makeContract = (extra: Record<string, unknown> = {}) =>
    Contract.create({
      landlord: new mongoose.Types.ObjectId(landlordId),
      tenant: new mongoose.Types.ObjectId(tenantId),
      property: new mongoose.Types.ObjectId(),
      rent: 800,
      deposit: 1600,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      region: 'madrid',
      status: 'active',
      signedByTenant: true,
      signedByLandlord: true,
      stripeCustomerId: 'cus_split_1',
      ...extra,
    });

  const sendWebhook = (type: string, object: Record<string, unknown>, id: string) => {
    const payload = JSON.stringify({ id, type, data: { object } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    return request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);
  };

  it('sin cuenta de cobros del propietario no se cobra y el recibo queda libre', async () => {
    const contract = await makeContract();
    const res = await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('owner_not_connected');
    expect(createIntent).not.toHaveBeenCalled();
    expect((await RentPayment.findOne({ contractId: contract._id }))?.status).toBe('DUE');

    // En cuanto el propietario conecta su cuenta, el mismo recibo se puede pagar.
    await connectLandlord(landlordId);
    await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send().expect(200);
    expect(createIntent).toHaveBeenCalledTimes(1);
  });

  it('con la cuenta sin verificar tampoco se cobra', async () => {
    await connectLandlord(landlordId, { transfers: 'pending' });
    const contract = await makeContract();
    const res = await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('owner_payouts_disabled');
    expect(createIntent).not.toHaveBeenCalled();
  });

  it('la renta va a la cuenta del propietario y la plataforma retiene comisión de renta y de firma', async () => {
    await connectLandlord(landlordId, { accountId: 'acct_owner_1' });
    const contract = await makeContract();
    await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send().expect(200);

    const params = createIntent.mock.calls[0][0];
    expect(params.amount).toBe(80000);
    expect(params.transfer_data).toEqual({ destination: 'acct_owner_1' });
    // 5 % de renta (40 €) + 2 % de firma la primera vez (16 €)
    expect(params.application_fee_amount).toBe(5600);
    expect(params.metadata).toMatchObject({
      type: 'rent',
      kind: 'rent',
      contractId: String(contract._id),
      ownerId: landlordId,
      rentFeeCents: '4000',
      signFeeCents: '1600',
    });
  });

  it('la comisión de firma se cobra una sola vez, cuando Stripe confirma el pago', async () => {
    await connectLandlord(landlordId);
    const contract = await makeContract();
    await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send().expect(200);
    expect((await Contract.findById(contract._id))?.signFeeCollected).toBeFalsy();

    const rent = await RentPayment.findOne({ contractId: contract._id });
    await sendWebhook(
      'payment_intent.succeeded',
      { id: 'pi_split_1', metadata: { ...createIntent.mock.calls[0][0].metadata, rentPaymentId: String(rent!._id) } },
      'evt_split_ok_1',
    ).expect(200);
    const after = await Contract.findById(contract._id);
    expect(after?.signFeeCollected).toBe(true);
    expect(after?.signFeeCollectedAt).toBeInstanceOf(Date);

    // El recibo de otro mes ya solo lleva la comisión de renta.
    const other = await Payment.create({
      contract: contract._id,
      payer: new mongoose.Types.ObjectId(tenantId),
      payee: new mongoose.Types.ObjectId(landlordId),
      amount: 800,
      currency: 'eur',
      type: 'rent',
      status: 'pending',
      concept: 'Renta siguiente',
      billingMonth: 1,
      billingYear: 2031,
    });
    await request(app).post(`/api/payments/${other._id}/pay`).set(asTenant).send().expect(200);
    const second = createIntent.mock.calls[1][0];
    expect(second.transfer_data).toEqual({ destination: 'acct_test_owner' });
    expect(second.application_fee_amount).toBe(4000);
    expect(second.metadata.signFeeCents).toBe('0');
  });

  it('pagar un recibo de renta sin cuenta del propietario da 409 con explicación y no lo deja bloqueado', async () => {
    const contract = await makeContract();
    const receipt = await Payment.create({
      contract: contract._id,
      payer: new mongoose.Types.ObjectId(tenantId),
      payee: new mongoose.Types.ObjectId(landlordId),
      amount: 800,
      currency: 'eur',
      type: 'rent',
      status: 'pending',
      concept: 'Renta',
      billingMonth: 2,
      billingYear: 2031,
    });
    const res = await request(app).post(`/api/payments/${receipt._id}/pay`).set(asTenant).send();
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('owner_not_connected');
    expect(res.body.message).toMatch(/propietario/i);
    expect((await Payment.findById(receipt._id))?.status).toBe('pending');
  });

  it('el pago por periodo (SEPA) también reparte', async () => {
    await connectLandlord(landlordId, { accountId: 'acct_owner_2' });
    const contract = await makeContract({ signFeeCollected: true });
    const period = rentPeriodOf(new Date());
    await request(app).post(`/api/contracts/${contract._id}/payments/${period}/pay`).set(asTenant).send().expect(200);
    const params = createPeriodIntent.mock.calls[0][0];
    expect(params.transfer_data).toEqual({ destination: 'acct_owner_2' });
    expect(params.application_fee_amount).toBe(4000);
    expect(params.metadata).toMatchObject({ kind: 'rent', rentFeeCents: '4000', period });
  });
});
