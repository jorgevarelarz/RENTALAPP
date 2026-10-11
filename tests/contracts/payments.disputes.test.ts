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

// Auditoría (pendiente de la ronda 26): disputas de Stripe sin gestionar y devoluciones de la
// fianza sin reconocer (el Checkout no ponía metadatos en el PaymentIntent).
describe('Fianza devuelta y disputas (webhook de Stripe)', () => {
  const tenantId = '507f1f77bcf86cd799439d01';
  const landlordId = '507f1f77bcf86cd799439d02';
  const asTenant = { 'x-user-id': tenantId, 'x-user-role': 'tenant', 'x-user-verified': 'true' };

  let listSessions: jest.SpyInstance;

  beforeAll(async () => {
    await connectDb();
    await Promise.all([RentPayment.init(), Payment.init()]);
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_disputes';
  });
  afterAll(disconnectDb);

  beforeEach(async () => {
    await User.create({
      _id: new mongoose.Types.ObjectId(tenantId),
      name: 'Inquilina',
      email: 'inquilina-dispute@test.com',
      passwordHash: 'hash',
      role: 'tenant',
    });
    const create = (async () => ({ id: 'pi_rent_1', client_secret: 'pi_rent_1_secret', status: 'requires_payment_method' })) as any;
    jest.spyOn(stripe.paymentIntents, 'create').mockImplementation(create);
    jest.spyOn(paymentStripe.paymentIntents, 'create').mockImplementation(create);
    jest.spyOn(stripe.charges, 'retrieve').mockImplementation((async (id: string) => ({
      id,
      payment_intent: id === 'ch_dep_old' ? 'pi_dep_old' : 'pi_rent_1',
      metadata: {},
      receipt_url: `https://pay.stripe.com/receipts/${id}`,
    })) as any);
    listSessions = jest.spyOn(stripe.checkout.sessions, 'list').mockResolvedValue({ data: [] } as any);
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
      startDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      region: 'madrid',
      status: 'signed',
      signedByTenant: true,
      signedByLandlord: true,
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

  const historyActions = async (contractId: unknown) =>
    (await ContractHistory.find({ contract: contractId }).lean()).map((h: any) => h.action);

  /** La fianza se paga por Checkout: el webhook guarda el PaymentIntent en el contrato. */
  const paidDeposit = async () => {
    const contract = await makeContract();
    await sendWebhook(
      'checkout.session.completed',
      { id: 'cs_dep_1', payment_intent: 'pi_dep_1', metadata: { deposit: 'true', contractId: String(contract._id) } },
      'evt_dep_paid',
    ).expect(200);
    return contract;
  };

  const dispute = (overrides: Record<string, unknown> = {}) => ({
    id: 'dp_1',
    charge: { id: 'ch_1', metadata: {} },
    payment_intent: 'pi_dep_1',
    amount: 160000,
    reason: 'fraudulent',
    status: 'needs_response',
    created: 1760000000,
    ...overrides,
  });

  it('al pagar la fianza guarda su PaymentIntent y una devolución total queda en el contrato', async () => {
    const contract = await paidDeposit();
    const paid = await Contract.findById(contract._id);
    expect(paid?.depositPaid).toBe(true);
    expect(paid?.depositPaymentIntentId).toBe('pi_dep_1');

    await sendWebhook(
      'charge.refunded',
      { id: 'ch_dep_1', payment_intent: 'pi_dep_1', amount: 160000, amount_refunded: 160000, refunded: true },
      'evt_dep_refund',
    ).expect(200);

    const refunded = await Contract.findById(contract._id);
    expect(refunded?.depositAmountRefunded).toBe(1600);
    expect(refunded?.depositRefundedAt).toBeInstanceOf(Date);
    expect(refunded?.depositPaid).toBe(true);
    expect(await historyActions(contract._id)).toContain('depositRefunded');
    expect(listSessions).not.toHaveBeenCalled();
  });

  it('una fianza cobrada antes del cambio se reconoce por su sesión de Checkout (devolución parcial)', async () => {
    const contract = await makeContract();
    listSessions.mockResolvedValueOnce({
      data: [{ id: 'cs_old', metadata: { deposit: 'true', contractId: String(contract._id) } }],
    } as any);

    await sendWebhook(
      'charge.refunded',
      { id: 'ch_dep_old', payment_intent: 'pi_dep_old', amount: 160000, amount_refunded: 40000, refunded: false },
      'evt_dep_old_refund',
    ).expect(200);

    expect(listSessions).toHaveBeenCalledWith({ payment_intent: 'pi_dep_old', limit: 1 });
    const updated = await Contract.findById(contract._id);
    expect(updated?.depositPaymentIntentId).toBe('pi_dep_old');
    expect(updated?.depositAmountRefunded).toBe(400);
    expect(updated?.depositRefundedAt).toBeUndefined();
    expect(await historyActions(contract._id)).toContain('depositPartiallyRefunded');
  });

  it('una disputa de la fianza se guarda en el contrato y al cerrarse no la reabre un evento tardío', async () => {
    const contract = await paidDeposit();

    await sendWebhook('charge.dispute.created', dispute(), 'evt_dp_created').expect(200);
    let saved = await Contract.findById(contract._id).lean();
    expect(saved?.depositDispute).toMatchObject({ id: 'dp_1', status: 'needs_response', reason: 'fraudulent', amount: 1600 });
    expect(saved?.depositDispute?.closedAt).toBeUndefined();

    await sendWebhook('charge.dispute.closed', dispute({ status: 'lost' }), 'evt_dp_closed').expect(200);
    await sendWebhook('charge.dispute.updated', dispute({ status: 'under_review' }), 'evt_dp_late').expect(200);
    saved = await Contract.findById(contract._id).lean();
    expect(saved?.depositDispute?.status).toBe('lost');
    expect(saved?.depositDispute?.closedAt).toBeInstanceOf(Date);

    const actions = await historyActions(contract._id);
    expect(actions.filter(a => a === 'paymentDisputed')).toHaveLength(1);
    expect(actions.filter(a => a === 'paymentDisputeClosed')).toHaveLength(1);
  });

  it('una disputa de la renta se guarda en el pago y en el recibo, sin cambiar su estado', async () => {
    const contract = await makeContract();
    await Contract.updateOne({ _id: contract._id }, { status: 'active', startDate: new Date() });
    await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send().expect(200);
    const rent = await RentPayment.findOne({ contractId: contract._id });
    const meta = { type: 'rent', contractId: String(contract._id), rentPaymentId: String(rent!._id) };
    await sendWebhook('payment_intent.succeeded', { id: 'pi_rent_1', latest_charge: 'ch_rent_1', metadata: meta }, 'evt_rent_ok').expect(200);

    // Sin `payment_intent` en la disputa: se lee del cargo.
    await sendWebhook(
      'charge.dispute.created',
      dispute({ id: 'dp_rent', charge: 'ch_rent_1', payment_intent: null, amount: 80000, reason: 'product_not_received' }),
      'evt_dp_rent',
    ).expect(200);

    const payment = await Payment.findOne({ stripePaymentIntentId: 'pi_rent_1' }).lean();
    expect(payment?.status).toBe('succeeded');
    expect(payment?.dispute).toMatchObject({ id: 'dp_rent', status: 'needs_response', amount: 800 });
    const receipt = await RentPayment.findById(rent!._id).lean();
    expect(receipt?.status).toBe('PAID');
    expect(receipt?.dispute?.id).toBe('dp_rent');
    expect(await historyActions(contract._id)).toContain('paymentDisputed');
  });

  it('una disputa de un cobro desconocido no falla ni toca nada', async () => {
    await sendWebhook('charge.dispute.created', dispute({ payment_intent: 'pi_desconocido' }), 'evt_dp_unknown').expect(200);
    expect(await Contract.countDocuments({ depositDispute: { $exists: true } })).toBe(0);
    expect(await Payment.countDocuments({ dispute: { $exists: true } })).toBe(0);
  });
});
