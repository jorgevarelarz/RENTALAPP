import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import Conversation from '../../src/models/conversation.model';
import ServiceOffer from '../../src/models/serviceOffer.model';
import Appointment from '../../src/models/appointment.model';
import PlatformEarning from '../../src/models/platformEarning.model';
import { stripe } from '../../src/utils/stripe';

// P2 de la auditoría de seguridad: accept-slot marcaba la oferta pagada sin cobro confirmado.
describe('Pago de ofertas de servicio (accept-slot)', () => {
  const ownerId = '507f1f77bcf86cd799439b01';
  const proId = '507f1f77bcf86cd799439b02';
  const asOwner = { 'x-user-id': ownerId, 'x-user-role': 'landlord', 'x-user-verified': 'true' };

  let createIntent: jest.SpyInstance;
  let intentSeq = 0;

  beforeAll(async () => {
    await connectDb();
    process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_offers';
  });
  afterAll(disconnectDb);

  beforeEach(async () => {
    intentSeq = 0;
    await User.create([
      { _id: new mongoose.Types.ObjectId(ownerId), name: 'Propietaria', email: 'owner@test.com', passwordHash: 'h', role: 'landlord' },
      { _id: new mongoose.Types.ObjectId(proId), name: 'Fontanero', email: 'pro@test.com', passwordHash: 'h', role: 'pro', stripeAccountId: 'acct_pro_1' },
    ]);
    createIntent = jest.spyOn(stripe.paymentIntents, 'create').mockImplementation((async () => {
      intentSeq += 1;
      await new Promise(resolve => setTimeout(resolve, 50));
      return { id: `pi_offer_${intentSeq}`, client_secret: `pi_offer_${intentSeq}_secret`, status: 'requires_payment_method' };
    }) as any);
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

  const makeOffer = async (status = 'scheduled') => {
    const conv = await Conversation.create({
      kind: 'ticket',
      refId: new mongoose.Types.ObjectId().toString(),
      participants: [ownerId, proId],
      meta: { ownerId, proUserId: proId },
      unread: {},
    });
    const appointment = await Appointment.create({
      proId, ownerId, tenantId: '507f1f77bcf86cd799439b03', start: new Date(), end: new Date(Date.now() + 3600000), timezone: 'Europe/Madrid', status: 'scheduled',
    } as any);
    return ServiceOffer.create({
      conversationId: conv.id, proId, ownerId, serviceKey: 'plumbing', title: 'Arreglo de fuga', amount: 120, currency: 'EUR', status,
      appointmentId: appointment.id,
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

  it('no confirma la oferta ni cuenta la ganancia hasta que llega el webhook', async () => {
    const offer = await makeOffer();
    const res = await request(app).post(`/api/service-offers/${offer.id}/accept-slot`).set(asOwner).send({}).expect(200);
    expect(res.body.paymentIntent.client_secret).toBe('pi_offer_1_secret');
    expect(res.body.offer.status).toBe('payment_pending');
    expect(await PlatformEarning.countDocuments()).toBe(0);
    expect((await Appointment.findById(offer.appointmentId))?.status).toBe('scheduled');
    // El importe y el destino los fija el servidor.
    expect(createIntent.mock.calls[0][0]).toMatchObject({ amount: 12000, transfer_data: { destination: 'acct_pro_1' }, metadata: { offerId: offer.id } });

    const intent = { id: 'pi_offer_1', metadata: { offerId: offer.id } };
    await sendWebhook('payment_intent.succeeded', intent, 'evt_offer_ok').expect(200);
    await sendWebhook('payment_intent.succeeded', intent, 'evt_offer_ok_retry').expect(200);

    expect((await ServiceOffer.findById(offer.id))?.status).toBe('confirmed');
    expect((await Appointment.findById(offer.appointmentId))?.status).toBe('confirmed');
    expect(await PlatformEarning.countDocuments({ offerId: offer.id })).toBe(1);
  });

  it('dos aceptaciones simultáneas crean un solo cobro y la siguiente lo reanuda', async () => {
    const offer = await makeOffer();
    const [a, b] = await Promise.all([
      request(app).post(`/api/service-offers/${offer.id}/accept-slot`).set(asOwner).send({}),
      request(app).post(`/api/service-offers/${offer.id}/accept-slot`).set(asOwner).send({}),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(createIntent).toHaveBeenCalledTimes(1);

    const again = await request(app).post(`/api/service-offers/${offer.id}/accept-slot`).set(asOwner).send({}).expect(200);
    expect(again.body.paymentIntent.id).toBe('pi_offer_1');
    expect(createIntent).toHaveBeenCalledTimes(1);
  });

  it('si Stripe falla o el pago falla, la oferta vuelve a estar pendiente de pago', async () => {
    const offer = await makeOffer();
    createIntent.mockRejectedValueOnce(new Error('stripe_down'));
    await request(app).post(`/api/service-offers/${offer.id}/accept-slot`).set(asOwner).send({}).expect(500);
    expect((await ServiceOffer.findById(offer.id))?.status).toBe('scheduled');

    await request(app).post(`/api/service-offers/${offer.id}/accept-slot`).set(asOwner).send({}).expect(200);
    await sendWebhook('payment_intent.payment_failed', { id: 'pi_offer_1', metadata: { offerId: offer.id } }, 'evt_offer_fail').expect(200);
    expect((await ServiceOffer.findById(offer.id))?.status).toBe('scheduled');
    expect(await PlatformEarning.countDocuments()).toBe(0);

    const retry = await request(app).post(`/api/service-offers/${offer.id}/accept-slot`).set(asOwner).send({}).expect(200);
    expect(retry.body.paymentIntent.id).toBe('pi_offer_2');
  });

  it('rechaza ofertas sin cita propuesta, ya confirmadas o ajenas', async () => {
    const proposed = await makeOffer('proposed');
    await request(app).post(`/api/service-offers/${proposed.id}/accept-slot`).set(asOwner).send({}).expect(409);
    const confirmed = await makeOffer('confirmed');
    await request(app).post(`/api/service-offers/${confirmed.id}/accept-slot`).set(asOwner).send({}).expect(409);
    const other = await makeOffer();
    await request(app)
      .post(`/api/service-offers/${other.id}/accept-slot`)
      .set({ ...asOwner, 'x-user-id': '507f1f77bcf86cd799439b09' })
      .send({})
      .expect(403);
    expect(createIntent).not.toHaveBeenCalled();
  });

  it('un intento antiguo no confirma una oferta que ya tiene otro intento vigente', async () => {
    const offer = await makeOffer();
    await request(app).post(`/api/service-offers/${offer.id}/accept-slot`).set(asOwner).send({}).expect(200);
    await sendWebhook('payment_intent.succeeded', { id: 'pi_otro', metadata: { offerId: offer.id } }, 'evt_offer_other').expect(200);
    expect((await ServiceOffer.findById(offer.id))?.status).toBe('payment_pending');
    expect(await PlatformEarning.countDocuments()).toBe(0);
  });
});
