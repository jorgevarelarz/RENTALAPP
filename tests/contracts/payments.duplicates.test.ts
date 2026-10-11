import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import { Contract } from '../../src/models/contract.model';
import { RentPayment } from '../../src/models/rentPayment.model';
import { Payment } from '../../src/models/payment.model';
import { stripe } from '../../src/utils/stripe';
import { stripe as paymentStripe } from '../../src/utils/payment';

// P3/P4 de la auditoría de seguridad: cobros duplicados de renta y fianza.
describe('Pagos sin cobros duplicados', () => {
  const tenantId = '507f1f77bcf86cd799439a01';
  const landlordId = '507f1f77bcf86cd799439a02';
  const asTenant = {
    'x-user-id': tenantId,
    'x-user-role': 'tenant',
    'x-user-verified': 'true',
  };
  const period = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  let createIntent: jest.SpyInstance;
  let intentSeq = 0;

  beforeAll(async () => {
    await connectDb();
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_duplicates';
  });
  afterAll(disconnectDb);

  beforeEach(async () => {
    intentSeq = 0;
    await User.create({
      _id: new mongoose.Types.ObjectId(tenantId),
      name: 'Inquilina',
      email: 'inquilina@test.com',
      passwordHash: 'hash',
      role: 'tenant',
    });
    createIntent = jest.spyOn(stripe.paymentIntents, 'create').mockImplementation((async () => {
      intentSeq += 1;
      // Simula la latencia de Stripe para que las peticiones se solapen.
      await new Promise(resolve => setTimeout(resolve, 50));
      return { id: `pi_dup_${intentSeq}`, client_secret: `pi_dup_${intentSeq}_secret`, status: 'requires_payment_method' };
    }) as any);
    // utils/payment tiene su propio cliente Stripe (lo usa el pago por periodo).
    jest.spyOn(paymentStripe.paymentIntents, 'create').mockImplementation(createIntent.getMockImplementation() as any);
    jest.spyOn(stripe.paymentIntents, 'retrieve').mockImplementation((async (id: string) => ({
      id,
      client_secret: `${id}_secret`,
      status: 'requires_payment_method',
    })) as any);
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
      stripeCustomerId: 'cus_dup_1',
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

  it('dos peticiones simultáneas de pay-rent crean un solo PaymentIntent', async () => {
    const contract = await makeContract();
    const [a, b] = await Promise.all([
      request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send(),
      request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send(),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(createIntent).toHaveBeenCalledTimes(1);
    expect(await RentPayment.countDocuments({ contractId: contract._id })).toBe(1);
    expect(await Payment.countDocuments({ contract: contract._id })).toBe(1);

    // Volver a pulsar «Pagar» reanuda el mismo intento en vez de quedarse sin clientSecret.
    const again = await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send();
    expect(again.status).toBe(200);
    expect(again.body.clientSecret).toBe('pi_dup_1_secret');
    expect(createIntent).toHaveBeenCalledTimes(1);
  });

  it('si Stripe falla al crear el intento, el recibo vuelve a DUE y se puede reintentar', async () => {
    const contract = await makeContract();
    createIntent.mockRejectedValueOnce(new Error('stripe_down'));
    await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send().expect(500);
    expect((await RentPayment.findOne({ contractId: contract._id }))?.status).toBe('DUE');

    const retry = await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send().expect(200);
    expect(retry.body.clientSecret).toMatch(/^pi_dup_\d+_secret$/);
  });

  it('tras un pago fallido se reintenta con otro intento y el fallo tardío no deshace el PAID', async () => {
    const contract = await makeContract();
    await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send().expect(200);
    const rent = await RentPayment.findOne({ contractId: contract._id });
    const meta = { type: 'rent', contractId: String(contract._id), rentPaymentId: String(rent!._id) };

    await sendWebhook('payment_intent.payment_failed', { id: 'pi_dup_1', metadata: meta }, 'evt_dup_fail_1').expect(200);
    expect((await RentPayment.findById(rent!._id))?.status).toBe('FAILED');
    expect((await Payment.findOne({ stripePaymentIntentId: 'pi_dup_1' }))?.status).toBe('failed');

    // Reintento: nuevo intento y el mismo Payment del mes (antes daba E11000).
    const retry = await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send().expect(200);
    expect(retry.body.clientSecret).toBe('pi_dup_2_secret');
    expect(await Payment.countDocuments({ contract: contract._id })).toBe(1);

    await sendWebhook('payment_intent.succeeded', { id: 'pi_dup_2', metadata: meta }, 'evt_dup_ok_2').expect(200);
    expect((await RentPayment.findById(rent!._id))?.status).toBe('PAID');

    // Un fallo o un «processing» tardíos no tocan el recibo pagado.
    await sendWebhook('payment_intent.payment_failed', { id: 'pi_dup_2', metadata: meta }, 'evt_dup_fail_2').expect(200);
    await sendWebhook('payment_intent.processing', { id: 'pi_dup_2', metadata: meta }, 'evt_dup_proc_2').expect(200);
    expect((await RentPayment.findById(rent!._id))?.status).toBe('PAID');
    expect((await Payment.findOne({ stripePaymentIntentId: 'pi_dup_2' }))?.status).toBe('succeeded');
  });

  it('pagos por periodo simultáneos crean un solo intento', async () => {
    const contract = await makeContract();
    const p = period();
    const [a, b] = await Promise.all([
      request(app).post(`/api/contracts/${contract._id}/payments/${p}/pay`).set(asTenant).send(),
      request(app).post(`/api/contracts/${contract._id}/payments/${p}/pay`).set(asTenant).send(),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(paymentStripe.paymentIntents.create).toHaveBeenCalledTimes(1);
  });

  it('payReceipt: dos peticiones simultáneas crean un solo intento y la tercera lo reanuda', async () => {
    const contract = await makeContract();
    const receipt = await Payment.create({
      contract: contract._id,
      payer: tenantId,
      payee: landlordId,
      amount: 800,
      type: 'service',
      status: 'pending',
    });
    const [a, b] = await Promise.all([
      request(app).post(`/api/payments/${receipt._id}/pay`).set(asTenant).send(),
      request(app).post(`/api/payments/${receipt._id}/pay`).set(asTenant).send(),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(createIntent).toHaveBeenCalledTimes(1);

    const again = await request(app).post(`/api/payments/${receipt._id}/pay`).set(asTenant).send().expect(200);
    expect(again.body.clientSecret).toBe('pi_dup_1_secret');
    expect(createIntent).toHaveBeenCalledTimes(1);
  });

  describe('fianza', () => {
    let createSession: jest.SpyInstance;
    let retrieveSession: jest.SpyInstance;
    const prevDriver = process.env.ESCROW_DRIVER;

    beforeEach(() => {
      process.env.ESCROW_DRIVER = 'stripe';
      process.env.FRONTEND_URL = 'https://app.example.test';
      createSession = jest.spyOn(stripe.checkout.sessions, 'create').mockImplementation((async (_params: any, opts: any) => ({
        id: `cs_${opts?.idempotencyKey}`,
        url: `https://checkout.stripe.test/cs_${opts?.idempotencyKey}`,
        status: 'open',
      })) as any);
      retrieveSession = jest.spyOn(stripe.checkout.sessions, 'retrieve').mockImplementation((async (id: string) => ({
        id,
        url: `https://checkout.stripe.test/${id}`,
        status: 'open',
      })) as any);
    });

    afterEach(() => {
      process.env.ESCROW_DRIVER = prevDriver;
      delete process.env.FRONTEND_URL;
    });

    it('reutiliza la sesión abierta e ignora las URLs del cliente', async () => {
      const contract = await makeContract({ status: 'signed' });
      const first = await request(app)
        .post(`/api/contracts/${contract._id}/deposit`)
        .set(asTenant)
        .send({ successUrl: 'https://evil.example/ok', cancelUrl: 'https://evil.example/ko' })
        .expect(200);
      expect(createSession).toHaveBeenCalledTimes(1);
      const [params, opts] = createSession.mock.calls[0];
      expect(params.success_url).toBe(`https://app.example.test/contracts/${contract._id}?deposit=success`);
      expect(params.cancel_url).toBe(`https://app.example.test/contracts/${contract._id}?deposit=cancel`);
      expect(params.line_items[0].price_data.unit_amount).toBe(160000);
      expect(opts.idempotencyKey).toBe(`deposit:${contract._id}:first`);

      const second = await request(app).post(`/api/contracts/${contract._id}/deposit`).set(asTenant).send().expect(200);
      expect(second.body.sessionUrl).toBe(first.body.sessionUrl);
      expect(createSession).toHaveBeenCalledTimes(1);
      expect(retrieveSession).toHaveBeenCalledTimes(1);
    });

    it('si la sesión anterior caducó crea otra; si se completó no deja pagar de nuevo', async () => {
      const contract = await makeContract({ status: 'signed' });
      await request(app).post(`/api/contracts/${contract._id}/deposit`).set(asTenant).send().expect(200);

      retrieveSession.mockResolvedValueOnce({ id: 'x', url: null, status: 'expired' });
      await request(app).post(`/api/contracts/${contract._id}/deposit`).set(asTenant).send().expect(200);
      expect(createSession).toHaveBeenCalledTimes(2);
      expect(createSession.mock.calls[1][1].idempotencyKey).toBe(`deposit:${contract._id}:cs_deposit:${contract._id}:first`);

      retrieveSession.mockResolvedValueOnce({ id: 'y', url: null, status: 'complete' });
      await request(app).post(`/api/contracts/${contract._id}/deposit`).set(asTenant).send().expect(409);
      expect(createSession).toHaveBeenCalledTimes(2);
    });
  });
});
