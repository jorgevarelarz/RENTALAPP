import cron from 'node-cron';
import { Types } from 'mongoose';
import { Contract } from '../models/contract.model';
import { RentPayment } from '../models/rentPayment.model';
import { recordContractHistory } from '../utils/history';
import { billableRent, checkRentPeriod, rentPeriodOf } from '../utils/rentPeriod';

/**
 * Genera el recibo del mes en curso de cada contrato activo. Un contrato que
 * falla (o un recibo creado a la vez por el pago del inquilino) no detiene a
 * los demás.
 */
export const runRentGeneration = async (now: Date = new Date()) => {
  console.log('[Job] Starting rent generation');
  const period = rentPeriodOf(now);
  let count = 0;
  let failed = 0;

  try {
    const contracts = await Contract.find({ status: 'active' }).select('_id rent startDate').lean();

    for (const contract of contracts) {
      try {
        if (checkRentPeriod(contract, period, now)) continue;
        const amount = billableRent(contract);
        if (amount === null) {
          console.warn(`[Job] Contrato ${contract._id} sin renta válida; no se genera recibo`);
          continue;
        }
        const result = await RentPayment.updateOne(
          { contractId: contract._id as Types.ObjectId, period },
          { $setOnInsert: { contractId: contract._id, period, amount, status: 'DUE' } },
          { upsert: true },
        );
        if (!result.upsertedCount) continue;
        await recordContractHistory(String(contract._id), 'rent_generated', `Recibo generado para ${period}`);
        count += 1;
      } catch (error: any) {
        if (error?.code === 11000) continue; // otro proceso lo creó a la vez
        failed += 1;
        console.error(`[Job] Error generando el recibo de ${contract._id}:`, error?.message ?? error);
      }
    }
  } catch (error) {
    console.error('[Job] Error generating rents:', error);
  }

  console.log(`[Job] Generated ${count} rent receipts for ${period}${failed ? `, ${failed} failed` : ''}`);
  return { period, created: count, failed };
};

export const startRentGenerationJob = () => {
  cron.schedule('0 1 * * *', () => {
    void runRentGeneration();
  });
  console.log('[Job] Rent generation scheduled at 01:00 daily');
};
