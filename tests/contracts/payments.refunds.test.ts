import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import { Contract } from '../../src/models/contract.model';
import { RentPayment } from '../../src/models/rentPayment.model';
import { Payment } from '../../src/models/payment.model';
import { ContractHistory } from '../../src/models/history.model';
import { stripe } from '../../src/utils/stripe';
import { stripe as paymentStripe } from '../../src/utils/payment';
import { rentPeriodOf } from '../../src/utils/rentPeriod';

// Auditoría (medios): reembolsos sin gestionar y URL del recibo leída de `intent.charges`,
// que no existe en la API 2022-11-15.
describe('Devoluciones de renta y recibo del cargo (webhook de Stripe)', () => {
  const tenantId = '507f1f77bcf86cd799439c01';
  const landlordId = '507f1f77bcf86cd799439c02';
  const asTenant = { 'x-user-id': tenantId, 'x-user-role': 'tenant', 'x-user-verified': 'true' };

  let intentSeq = 0;
  let retrieveCharge: jest.SpyInstance;

  beforeAll(async () => {
    await connectDb();
    await Promise.all([RentPayment.init(), Payment.init()]);
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_refunds';
  });
  afterAll(disconnectDb);

  beforeEach(async () => {
    intentSeq = 0;
    await User.create({
      _id: new mongoose.Types.ObjectId(tenantId),
      name: 'Inquilina',
      email: 'inquilina-refund@test.com',
      passwordHash: 'hash',
      role: 'tenant',
    });
    const create = (async () => {
      intentSeq += 1;
      return { id: `pi_ref_${intentSeq}`, client_secret: `pi_ref_${intentSeq}_secret`, status: 'requires_payment_method' };
    }) as any;
    jest.spyOn(stripe.paymentIntents, 'create').mockImplementation(create);
    jest.spyOn(paymentStripe.paymentIntents, 'create').mockImplementation(create);
    jest.spyOn(stripe.paymentIntents, 'retrieve').mockImplementation((async (id: string) => ({
      id,
      client_secret: `${id}_secret`,
      status: 'requires_payment_method',
    })) as any);
    retrieveCharge = jest.spyOn(stripe.charges, 'retrieve').mockImplementation((async (id: string) => ({
      id,
      receipt_url: `https://pay.stripe.com/receipts/${id}`,
    })) as any);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await clearDb();
  });

  const makeContract = () =>
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
      stripeCustomerId: 'cus_ref_1',
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

  /** Inquilina paga la renta del mes y llega el webhook de cobro correcto. */
  const paidRent = async () => {
    const contract = await makeContract();
    await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send().expect(200);
    const rent = await RentPayment.findOne({ contractId: contract._id });
    const meta = { type: 'rent', contractId: String(contract._id), rentPaymentId: String(rent!._id) };
    await sendWebhook('payment_intent.succeeded', { id: 'pi_ref_1', latest_charge: 'ch_ref_1', metadata: meta }, 'evt_ref_ok').expect(200);
    return { contract, rent: rent!, meta };
  };

  it('guarda el cargo y la URL del recibo a partir de latest_charge', async () => {
    await paidRent();
    expect(retrieveCharge).toHaveBeenCalledWith('ch_ref_1');
    const payment = await Payment.findOne({ stripePaymentIntentId: 'pi_ref_1' });
    expect(payment?.status).toBe('succeeded');
    expect(payment?.stripeChargeId).toBe('ch_ref_1');
    expect(payment?.receiptUrl).toBe('https://pay.stripe.com/receipts/ch_ref_1');
  });

  it('si no se puede leer el cargo, el pago se confirma igual (sin recibo)', async () => {
    retrieveCharge.mockRejectedValueOnce(new Error('stripe_down'));
    const { rent } = await paidRent();
    expect((await RentPayment.findById(rent._id))?.status).toBe('PAID');
    const payment = await Payment.findOne({ stripePaymentIntentId: 'pi_ref_1' });
    expect(payment?.status).toBe('succeeded');
    expect(payment?.receiptUrl).toBeUndefined();
  });

  it('una devolución parcial anota el importe y no cambia los estados', async () => {
    const { rent, contract } = await paidRent();
    await sendWebhook(
      'charge.refunded',
      { id: 'ch_ref_1', payment_intent: 'pi_ref_1', amount: 80000, amount_refunded: 20000, refunded: false },
      'evt_ref_partial',
    ).expect(200);
    const payment = await Payment.findOne({ stripePaymentIntentId: 'pi_ref_1' });
    expect(payment?.status).toBe('succeeded');
    expect(payment?.amountRefunded).toBe(200);
    expect((await RentPayment.findById(rent._id))?.status).toBe('PAID');
    const history = await ContractHistory.findOne({ contract: contract._id });
    expect(JSON.stringify(history)).toContain('paymentPartiallyRefunded');
  });

  it('una devolución total marca pago y recibo como devueltos, y no se reabren ni se vuelven a cobrar solos', async () => {
    const { contract, rent, meta } = await paidRent();
    await sendWebhook(
      'charge.refunded',
      { id: 'ch_ref_1', payment_intent: 'pi_ref_1', amount: 80000, amount_refunded: 80000, refunded: true },
      'evt_ref_full',
    ).expect(200);

    const payment = await Payment.findOne({ stripePaymentIntentId: 'pi_ref_1' });
    expect(payment?.status).toBe('refunded');
    expect(payment?.amountRefunded).toBe(800);
    expect(payment?.refundedAt).toBeInstanceOf(Date);
    const refunded = await RentPayment.findById(rent._id);
    expect(refunded?.status).toBe('REFUNDED');
    expect(refunded?.refundedAt).toBeInstanceOf(Date);
    const history = await ContractHistory.findOne({ contract: contract._id });
    expect(JSON.stringify(history)).toContain('paymentRefunded');

    // Eventos tardíos del mismo intento no deshacen la devolución.
    await sendWebhook('payment_intent.succeeded', { id: 'pi_ref_1', metadata: meta }, 'evt_ref_ok_late').expect(200);
    await sendWebhook('payment_intent.processing', { id: 'pi_ref_1', metadata: meta }, 'evt_ref_proc_late').expect(200);
    await sendWebhook('payment_intent.payment_failed', { id: 'pi_ref_1', metadata: meta }, 'evt_ref_fail_late').expect(200);
    expect((await RentPayment.findById(rent._id))?.status).toBe('REFUNDED');
    expect((await Payment.findOne({ stripePaymentIntentId: 'pi_ref_1' }))?.status).toBe('refunded');

    // El mes devuelto no se vuelve a cobrar por ninguna de las dos rutas.
    const again = await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send();
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('rent_refunded');
    const byPeriod = await request(app)
      .post(`/api/contracts/${contract._id}/payments/${rentPeriodOf(new Date())}/pay`)
      .set(asTenant)
      .send();
    expect(byPeriod.status).toBe(409);
    expect(byPeriod.body.error).toBe('rent_refunded');
    expect(stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(paymentStripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it('una devolución de un intento desconocido no falla ni toca nada', async () => {
    jest.spyOn(stripe.checkout.sessions, 'list').mockResolvedValue({ data: [] } as any);
    await sendWebhook(
      'charge.refunded',
      { id: 'ch_x', payment_intent: 'pi_desconocido', amount: 1000, amount_refunded: 1000, refunded: true },
      'evt_ref_unknown',
    ).expect(200);
    expect(await Payment.countDocuments({ status: 'refunded' })).toBe(0);
  });
});
