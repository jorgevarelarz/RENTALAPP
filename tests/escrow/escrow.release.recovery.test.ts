import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';
import Ticket from '../../src/models/ticket.model';
import Escrow from '../../src/models/escrow.model';
import PlatformEarning from '../../src/models/platformEarning.model';
import * as payment from '../../src/utils/payment';
import { resumeStuckEscrowReleases, ESCROW_RELEASE_TTL_MS } from '../../src/services/ticketEscrow.service';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';
const token = (_id: string, role: string) => `Bearer ${jwt.sign({ _id, role }, JWT_SECRET)}`;

const LANDLORD = '507f1f77bcf86cd799439011';
const TENANT = '507f1f77bcf86cd799439010';
const PRO = '507f1f77bcf86cd799439020';
const L = token(LANDLORD, 'landlord');

describe('Escrow release recovery', () => {
  const originalBypass = process.env.ALLOW_POLICY_BYPASS;
  beforeAll(async () => {
    process.env.ESCROW_DRIVER = 'mock';
    process.env.ALLOW_POLICY_BYPASS = 'true';
    await connectDb();
    await PlatformEarning.init(); // índice único por escrowId
  });
  afterAll(async () => {
    if (originalBypass === undefined) delete process.env.ALLOW_POLICY_BYPASS;
    else process.env.ALLOW_POLICY_BYPASS = originalBypass;
    await disconnectDb();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await clearDb();
  });

  /** Ticket con presupuesto aprobado (escrow held) y trabajo completado, listo para validar. */
  const readyTicket = async () => {
    const contract = await Contract.create({
      landlord: LANDLORD, tenant: TENANT, property: '507f1f77bcf86cd799439012',
      rent: 700, deposit: 700, startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000),
      region: 'general', clauses: [], status: 'active',
    });
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', token(TENANT, 'tenant'))
      .send({ contractId: String(contract._id), service: 'maintenance', title: 'Grifo', description: 'Gotea' })
      .expect(201);
    const ticketId = res.body._id as string;
    await Ticket.updateOne({ _id: ticketId }, { $set: { proId: PRO } });
    await request(app).post(`/api/tickets/${ticketId}/quote`).set('Authorization', token(PRO, 'pro')).send({ amount: 100 }).expect(200);
    await request(app).post(`/api/tickets/${ticketId}/approve`).set('Authorization', L).send({ customerId: 'cus_mock' }).expect(200);
    await request(app).post(`/api/tickets/${ticketId}/complete`).set('Authorization', token(PRO, 'pro')).send({}).expect(200);
    const t = await Ticket.findById(ticketId).lean();
    return { ticketId, escrowId: String(t!.escrowId) };
  };

  const expireLock = (escrowId: string) =>
    Escrow.updateOne({ _id: escrowId }, { $set: { releasingAt: new Date(Date.now() - ESCROW_RELEASE_TTL_MS - 1000) } });

  it('finishes a release cut after the capture without capturing twice', async () => {
    const { ticketId, escrowId } = await readyTicket();
    const capture = jest.spyOn(payment, 'releasePayment');
    // La BD falla justo después de cobrar
    jest.spyOn(PlatformEarning, 'updateOne').mockRejectedValueOnce(new Error('db down'));

    await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', L).expect(500);
    let esc = await Escrow.findById(escrowId).lean();
    expect(esc?.status).toBe('releasing');
    expect(esc?.releaseRef).toBeTruthy();

    // Mientras dura el bloqueo, repetir no hace nada
    const busy = await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', L).expect(409);
    expect(busy.body.error).toBe('release_in_progress');

    await expireLock(escrowId);
    const result = await resumeStuckEscrowReleases();
    expect(result).toMatchObject({ found: 1, completed: 1, failed: [] });

    esc = await Escrow.findById(escrowId).lean();
    expect(esc?.status).toBe('released');
    expect(esc?.ledger.filter((e) => e.type === 'release')).toHaveLength(1);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(await PlatformEarning.countDocuments({ escrowId })).toBe(1);
    const t = await Ticket.findById(ticketId).lean();
    expect(t?.status).toBe('closed');
    expect(t?.history.filter((h) => h.action === 'validated_and_released')).toHaveLength(1);
    expect(await resumeStuckEscrowReleases()).toMatchObject({ found: 0 });
  });

  it('lets the user retry the release once the lock has expired', async () => {
    const { ticketId, escrowId } = await readyTicket();
    jest.spyOn(Ticket, 'updateOne').mockRejectedValueOnce(new Error('db down'));
    await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', L).expect(500);
    expect(await PlatformEarning.countDocuments({ escrowId })).toBe(1);

    await expireLock(escrowId);
    const res = await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', L).expect(200);
    expect(res.body.escrow.status).toBe('released');
    expect(res.body.ticket.status).toBe('closed');
    expect(await PlatformEarning.countDocuments({ escrowId })).toBe(1);
  });

  it('goes back to held when the capture itself fails', async () => {
    const { ticketId, escrowId } = await readyTicket();
    jest.spyOn(payment, 'releasePayment').mockRejectedValueOnce(Object.assign(new Error('stripe down'), { status: 502 }));
    await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', L).expect(502);
    expect((await Escrow.findById(escrowId).lean())?.status).toBe('held');

    await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', L).expect(200);
    expect((await Escrow.findById(escrowId).lean())?.status).toBe('released');
  });

  it('releases once when owner and tenant confirm at the same time', async () => {
    const { ticketId, escrowId } = await readyTicket();
    const capture = jest.spyOn(payment, 'releasePayment');
    const [a, b] = await Promise.all([
      request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', L),
      request(app).post(`/api/tickets/${ticketId}/resolve`).set('Authorization', token(TENANT, 'tenant')),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(await PlatformEarning.countDocuments({ escrowId })).toBe(1);
  });
});

describe('releasePayment (Stripe)', () => {
  const originalDriver = process.env.ESCROW_DRIVER;
  afterEach(() => {
    jest.restoreAllMocks();
    process.env.ESCROW_DRIVER = originalDriver;
  });

  it('sends an idempotency key and treats an already captured PaymentIntent as released', async () => {
    process.env.ESCROW_DRIVER = 'stripe';
    const capture = jest
      .spyOn(payment.stripe.paymentIntents, 'capture')
      .mockRejectedValue(Object.assign(new Error('already captured'), { code: 'payment_intent_unexpected_state' }));
    jest.spyOn(payment.stripe.paymentIntents, 'retrieve').mockResolvedValue({ id: 'pi_1', status: 'succeeded' } as any);

    const rel = await payment.releasePayment({ ref: 'pi_1', amount: 100, currency: 'eur', fee: 10, idempotencyKey: 'escrow-release-x' });
    expect(rel).toEqual({ provider: 'stripe', ref: 'pi_1' });
    expect(capture.mock.calls[0][2]).toEqual({ idempotencyKey: 'escrow-release-x' });
  });

  it('still fails when the PaymentIntent was not captured', async () => {
    process.env.ESCROW_DRIVER = 'stripe';
    jest
      .spyOn(payment.stripe.paymentIntents, 'capture')
      .mockRejectedValue(Object.assign(new Error('canceled'), { code: 'payment_intent_unexpected_state' }));
    jest.spyOn(payment.stripe.paymentIntents, 'retrieve').mockResolvedValue({ id: 'pi_2', status: 'canceled' } as any);
    await expect(payment.releasePayment({ ref: 'pi_2', amount: 100, currency: 'eur' })).rejects.toThrow('canceled');
  });
});
