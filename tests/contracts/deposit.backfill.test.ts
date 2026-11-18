import mongoose from 'mongoose';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';
import { Payment } from '../../src/models/payment.model';
import { backfillDepositPayments } from '../../src/services/depositPayment.service';

// Fianzas cobradas antes de que el webhook guardara su `Payment` (ronda 40).
describe('Relleno de los pagos de fianza', () => {
  beforeAll(async () => {
    await connectDb();
    await Payment.init();
  });
  afterAll(disconnectDb);
  afterEach(clearDb);

  const makeContract = (extra: Record<string, unknown> = {}) =>
    Contract.create({
      landlord: new mongoose.Types.ObjectId(),
      tenant: new mongoose.Types.ObjectId(),
      property: new mongoose.Types.ObjectId(),
      rent: 800,
      deposit: 1600,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2027-08-31'),
      region: 'madrid',
      status: 'active',
      ...extra,
    });

  it('en prueba solo cuenta; con apply crea cada fianza una vez, con su devolución', async () => {
    const paid = await makeContract({
      depositPaid: true,
      depositPaidAt: new Date('2026-08-20T10:00:00Z'),
      depositPaymentIntentId: 'pi_old_1',
    });
    const refunded = await makeContract({
      depositPaid: true,
      depositPaidAt: new Date('2026-08-21T10:00:00Z'),
      depositPaymentIntentId: 'pi_old_2',
      depositAmountRefunded: 1600,
      depositRefundedAt: new Date('2026-09-30T10:00:00Z'),
    });
    const noIntent = await makeContract({ depositPaid: true, depositPaidAt: new Date() });
    await makeContract({ depositPaid: false });
    const already = await makeContract({ depositPaid: true, depositPaymentIntentId: 'pi_new' });
    await Payment.create({
      contract: already._id,
      payer: already.tenant,
      amount: 1600,
      type: 'deposit',
      status: 'succeeded',
      stripePaymentIntentId: 'pi_new',
    });

    const dry = await backfillDepositPayments({ apply: false });
    expect(dry.created.sort()).toEqual([String(paid._id), String(refunded._id)].sort());
    expect(dry.withoutIntent).toEqual([String(noIntent._id)]);
    expect(await Payment.countDocuments()).toBe(1);

    const run = await backfillDepositPayments({ apply: true });
    expect(run.created).toHaveLength(2);
    const first = await Payment.findOne({ stripePaymentIntentId: 'pi_old_1' }).lean();
    expect(first).toMatchObject({ type: 'deposit', status: 'succeeded', amount: 1600, concept: 'Fianza' });
    expect(String(first?.payer)).toBe(String(paid.tenant));
    expect(String(first?.payee)).toBe(String(paid.landlord));
    expect(first?.paidAt?.toISOString()).toBe('2026-08-20T10:00:00.000Z');
    const second = await Payment.findOne({ stripePaymentIntentId: 'pi_old_2' }).lean();
    expect(second).toMatchObject({ status: 'refunded', amountRefunded: 1600 });

    const again = await backfillDepositPayments({ apply: true });
    expect(again.created).toEqual([]);
    expect(await Payment.countDocuments()).toBe(3);
  });
});
