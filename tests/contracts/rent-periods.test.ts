import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import { Contract } from '../../src/models/contract.model';
import { RentPayment } from '../../src/models/rentPayment.model';
import { stripe } from '../../src/utils/stripe';
import { stripe as paymentStripe } from '../../src/utils/payment';
import { runRentGeneration } from '../../src/jobs/rentGeneration.job';
import { checkRentPeriod, rentPeriodOf } from '../../src/utils/rentPeriod';

describe('rentPeriod', () => {
  it('usa la hora de Madrid para el mes', () => {
    // 1 de noviembre a las 00:30 en Madrid es todavía 31 de octubre en UTC.
    expect(rentPeriodOf(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11');
    expect(rentPeriodOf(new Date('2026-07-31T21:30:00Z'))).toBe('2026-07');
  });

  it('acepta del mes de inicio al mes en curso', () => {
    const now = new Date('2026-10-15T10:00:00Z');
    const contract = { startDate: new Date('2026-08-31T22:00:00Z') }; // 1 sep en Madrid
    expect(checkRentPeriod(contract, '2026-08', now)).toBe('period_before_start');
    expect(checkRentPeriod(contract, '2026-09', now)).toBeNull();
    expect(checkRentPeriod(contract, '2026-10', now)).toBeNull();
    expect(checkRentPeriod(contract, '2026-11', now)).toBe('period_in_future');
  });
});

describe('Recibos de renta: meses del contrato y generación diaria', () => {
  const tenantId = '507f1f77bcf86cd799439b01';
  const landlordId = '507f1f77bcf86cd799439b02';
  const asTenant = { 'x-user-id': tenantId, 'x-user-role': 'tenant', 'x-user-verified': 'true' };
  const current = () => rentPeriodOf(new Date());
  const monthsFromNow = (n: number) => {
    const d = new Date();
    d.setUTCDate(15);
    d.setUTCMonth(d.getUTCMonth() + n);
    return d;
  };
  let createIntent: jest.SpyInstance;

  beforeAll(async () => {
    await connectDb();
    await RentPayment.init();
  });
  afterAll(disconnectDb);

  beforeEach(async () => {
    await User.create({
      _id: new mongoose.Types.ObjectId(tenantId),
      name: 'Inquilina',
      email: 'inquilina-periodos@test.com',
      passwordHash: 'hash',
      role: 'tenant',
    });
    const intent = (async () => ({ id: 'pi_period', client_secret: 'pi_period_secret', status: 'requires_payment_method' })) as any;
    createIntent = jest.spyOn(paymentStripe.paymentIntents, 'create').mockImplementation(intent);
    jest.spyOn(stripe.paymentIntents, 'create').mockImplementation(intent);
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
      startDate: monthsFromNow(-3),
      endDate: monthsFromNow(9),
      region: 'madrid',
      status: 'active',
      signedByTenant: true,
      signedByLandlord: true,
      stripeCustomerId: 'cus_period_1',
      ...extra,
    });

  const payPeriod = (contractId: unknown, period: string) =>
    request(app).post(`/api/contracts/${contractId}/payments/${period}/pay`).set(asTenant).send();

  it('cobra un mes del contrato ya vencido o el en curso', async () => {
    const contract = await makeContract();
    const past = rentPeriodOf(monthsFromNow(-2));
    const res = await payPeriod(contract._id, past);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'PROCESSING', amount: 800 });
    expect(await RentPayment.countDocuments({ contractId: contract._id, period: past })).toBe(1);
  });

  it('rechaza meses futuros o anteriores al inicio sin crear recibo ni cobro', async () => {
    const contract = await makeContract();
    const future = await payPeriod(contract._id, rentPeriodOf(monthsFromNow(1)));
    expect(future.status).toBe(400);
    expect(future.body.error).toBe('period_in_future');
    const before = await payPeriod(contract._id, rentPeriodOf(monthsFromNow(-4)));
    expect(before.status).toBe(400);
    expect(before.body.error).toBe('period_before_start');
    const ancient = await payPeriod(contract._id, '1999-01');
    expect(ancient.body.error).toBe('period_before_start');
    expect(await RentPayment.countDocuments({ contractId: contract._id })).toBe(0);
    expect(createIntent).not.toHaveBeenCalled();
  });

  it('no cobra la renta de un contrato terminado', async () => {
    const contract = await makeContract({ status: 'terminated' });
    const res = await payPeriod(contract._id, current());
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('contract_not_active');
    expect(createIntent).not.toHaveBeenCalled();
  });

  it('pay-rent no cobra un contrato firmado que empieza el mes que viene', async () => {
    const contract = await makeContract({ status: 'signed', startDate: monthsFromNow(1), endDate: monthsFromNow(13) });
    const res = await request(app).post(`/api/contracts/${contract._id}/pay-rent`).set(asTenant).send();
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('period_before_start');
    expect(await RentPayment.countDocuments({ contractId: contract._id })).toBe(0);
  });

  it('el job sigue con los demás contratos aunque uno ya tenga recibo o no tenga renta válida', async () => {
    const withReceipt = await makeContract();
    await RentPayment.create({ contractId: withReceipt._id, period: current(), amount: 800, status: 'PAID' });
    const noRent = await makeContract();
    await Contract.collection.updateOne({ _id: noRent._id }, { $set: { rent: 0 } });
    const notStarted = await makeContract({ startDate: monthsFromNow(1), endDate: monthsFromNow(13) });
    const pending = await makeContract({ rent: 950.004 });
    const terminated = await makeContract({ status: 'terminated' });

    const first = await runRentGeneration();
    expect(first).toMatchObject({ period: current(), created: 1, failed: 0 });
    const second = await runRentGeneration();
    expect(second.created).toBe(0);

    const receipt = await RentPayment.findOne({ contractId: pending._id }).lean();
    expect(receipt).toMatchObject({ period: current(), amount: 950, status: 'DUE' });
    expect(await RentPayment.findOne({ contractId: withReceipt._id }).lean()).toMatchObject({ status: 'PAID' });
    for (const c of [noRent, notStarted, terminated]) {
      expect(await RentPayment.countDocuments({ contractId: c._id })).toBe(0);
    }
  });
});
