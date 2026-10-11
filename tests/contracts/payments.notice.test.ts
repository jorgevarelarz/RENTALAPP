import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import { Contract } from '../../src/models/contract.model';
import { Property } from '../../src/models/property.model';
import { RentPayment } from '../../src/models/rentPayment.model';
import { Payment } from '../../src/models/payment.model';
import { stripe } from '../../src/utils/stripe';
import { stripe as paymentStripe } from '../../src/utils/payment';
import { sendPaymentNoticeEmail } from '../../src/utils/email';

jest.mock('../../src/utils/email', () => ({
  ...jest.requireActual('../../src/utils/email'),
  sendPaymentNoticeEmail: jest.fn().mockResolvedValue('sent'),
}));
const sent = sendPaymentNoticeEmail as jest.MockedFunction<typeof sendPaymentNoticeEmail>;

/** El aviso sale sin bloquear la respuesta del webhook: espera a que lleguen `n` correos. */
const waitForEmails = async (n: number) => {
  for (let i = 0; i < 50 && sent.mock.calls.length < n; i += 1) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return sent.mock.calls;
};
const settle = () => new Promise(resolve => setTimeout(resolve, 150));

// Correo de cobro: justificante al inquilino y aviso al casero, una sola vez por pago.
describe('Avisos de cobro de renta y fianza (webhook de Stripe)', () => {
  const tenantId = '507f1f77bcf86cd799439d01';
  const landlordId = '507f1f77bcf86cd799439d02';
  const asTenant = { 'x-user-id': tenantId, 'x-user-role': 'tenant', 'x-user-verified': 'true' };

  beforeAll(async () => {
    await connectDb();
    await Promise.all([RentPayment.init(), Payment.init()]);
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_notice';
  });
  afterAll(disconnectDb);

  beforeEach(async () => {
    sent.mockClear();
    await User.create([
      { _id: new mongoose.Types.ObjectId(tenantId), name: 'Inquilina', email: 'inquilina-aviso@test.com', passwordHash: 'h', role: 'tenant' },
      { _id: new mongoose.Types.ObjectId(landlordId), name: 'Casero', email: 'casero-aviso@test.com', passwordHash: 'h', role: 'landlord' },
    ]);
    let seq = 0;
    const create = (async () => {
      seq += 1;
      return { id: `pi_av_${seq}`, client_secret: `pi_av_${seq}_secret`, status: 'requires_payment_method' };
    }) as any;
    jest.spyOn(stripe.paymentIntents, 'create').mockImplementation(create);
    jest.spyOn(paymentStripe.paymentIntents, 'create').mockImplementation(create);
    jest.spyOn(stripe.charges, 'retrieve').mockImplementation((async (id: string) => ({
      id,
      receipt_url: `https://pay.stripe.com/receipts/${id}`,
    })) as any);
  });

  afterEach(async () => {
    await settle();
    jest.restoreAllMocks();
    await clearDb();
  });

  const makeContract = async () => {
    const property = await Property.create({
      title: 'Piso en Chamberí',
      address: 'Calle de Fuencarral 100',
      city: 'Madrid',
      region: 'madrid',
      price: 800,
      deposit: 1600,
      availableFrom: new Date(),
      owner: new mongoose.Types.ObjectId(landlordId),
      location: { type: 'Point', coordinates: [-3.7, 40.43] },
    });
    return Contract.create({
      landlord: new mongoose.Types.ObjectId(landlordId),
      tenant: new mongoose.Types.ObjectId(tenantId),
      property: property._id,
      rent: 800,
      deposit: 1600,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      region: 'madrid',
      status: 'active',
      signedByTenant: true,
      signedByLandlord: true,
      stripeCustomerId: 'cus_av_1',
    });
  };

  const sendWebhook = (type: string, object: Record<string, unknown>, id: string) => {
    const payload = JSON.stringify({ id, type, data: { object } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    return request(app)
      .post('/api/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);
  };

  it('al cobrar la renta avisa al inquilino y al casero una sola vez, aunque el evento se reenvíe', async () => {
    const contract = await makeContract();
    await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send().expect(200);
    const rent = await RentPayment.findOne({ contractId: contract._id });
    const meta = { type: 'rent', contractId: String(contract._id), rentPaymentId: String(rent!._id) };
    await sendWebhook('payment_intent.succeeded', { id: 'pi_av_1', latest_charge: 'ch_av_1', metadata: meta }, 'evt_av_1').expect(200);

    const calls = await waitForEmails(2);
    expect(calls).toHaveLength(2);
    const payment = await Payment.findOne({ stripePaymentIntentId: 'pi_av_1' }).lean();
    const concept = `Renta de ${new Date(Date.UTC(payment!.billingYear!, payment!.billingMonth! - 1, 15)).toLocaleString('es-ES', { month: 'long' })} de ${payment!.billingYear}`;
    const byAudience = Object.fromEntries(calls.map(([to, notice]) => [notice.audience, { to, notice }]));
    expect(byAudience.payer).toMatchObject({
      to: 'inquilina-aviso@test.com',
      notice: { concept, amount: 800, hasReceipt: true, name: 'Inquilina' },
    });
    expect(byAudience.payee).toMatchObject({
      to: 'casero-aviso@test.com',
      notice: {
        concept,
        amount: 800,
        name: 'Casero',
        payerName: 'Inquilina',
        contractId: String(contract._id),
        propertyTitle: 'Piso en Chamberí',
        propertyAddress: 'Calle de Fuencarral 100, Madrid',
      },
    });
    const paidAt = payment!.paidAt!.getTime();

    // Stripe reenvía el cobro con otro id de evento: sin correos nuevos y con la misma fecha de pago.
    await new Promise(resolve => setTimeout(resolve, 10));
    await sendWebhook('payment_intent.succeeded', { id: 'pi_av_1', latest_charge: 'ch_av_2', metadata: meta }, 'evt_av_1_bis').expect(200);
    await settle();
    expect(sent).toHaveBeenCalledTimes(2);
    const again = await Payment.findOne({ stripePaymentIntentId: 'pi_av_1' }).lean();
    expect(again?.paidAt?.getTime()).toBe(paidAt);
    expect(again?.stripeChargeId).toBe('ch_av_2');
  });

  it('una renta ya devuelta no vuelve a cobrarse ni avisa si llega tarde el evento', async () => {
    const contract = await makeContract();
    await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send().expect(200);
    await Payment.updateOne({ stripePaymentIntentId: 'pi_av_1' }, { $set: { status: 'refunded' } });
    const meta = { type: 'rent', contractId: String(contract._id) };
    await sendWebhook('payment_intent.succeeded', { id: 'pi_av_1', latest_charge: 'ch_av_1', metadata: meta }, 'evt_av_late').expect(200);
    await settle();
    expect(sent).not.toHaveBeenCalled();
    expect((await Payment.findOne({ stripePaymentIntentId: 'pi_av_1' }).lean())?.status).toBe('refunded');
  });

  it('al cobrar la fianza avisa una vez aunque la sesión de Checkout llegue dos veces', async () => {
    const contract = await makeContract();
    const session = {
      id: 'cs_av_1',
      payment_intent: 'pi_av_dep',
      amount_total: 160000,
      currency: 'eur',
      metadata: { deposit: 'true', contractId: String(contract._id) },
    };
    await sendWebhook('checkout.session.completed', session, 'evt_av_dep').expect(200);
    await sendWebhook('checkout.session.completed', session, 'evt_av_dep_bis').expect(200);

    const calls = await waitForEmails(2);
    await settle();
    expect(sent).toHaveBeenCalledTimes(2);
    expect(calls.map(([to, n]) => [to, n.audience, n.concept, n.amount])).toEqual(
      expect.arrayContaining([
        ['inquilina-aviso@test.com', 'payer', 'Fianza', 1600],
        ['casero-aviso@test.com', 'payee', 'Fianza', 1600],
      ]),
    );
  });
});
