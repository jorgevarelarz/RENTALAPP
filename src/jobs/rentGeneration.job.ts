import cron from 'node-cron';
import { Contract } from '../models/contract.model';
import { RentPayment } from '../models/rentPayment.model';
import { recordContractHistory } from '../utils/history';

export const runRentGeneration = async () => {
  console.log('[Job] Starting rent generation');
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const period = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  try {
    const contracts = await Contract.find({ status: 'active' });
    let count = 0;

    for (const contract of contracts) {
      const exists = await RentPayment.findOne({
        contractId: contract._id,
        period,
      }).lean();

      if (exists) continue;

      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 5);

      await RentPayment.create({
        contractId: contract._id,
        period,
        amount: contract.rent ?? (contract as any).rentAmount ?? 0,
        status: 'DUE',
      });

      await recordContractHistory(
        contract.id,
        'rent_generated',
        `Recibo generado para ${period}`,
      );

      count += 1;
    }

    if (count > 0) {
      console.log(`[Job] Generated ${count} rent receipts`);
    } else {
      console.log('[Job] No new rent receipts generated');
    }
  } catch (error) {
    console.error('[Job] Error generating rents:', error);
  }
};

export const startRentGenerationJob = () => {
  cron.schedule('0 1 * * *', runRentGeneration);
  console.log('[Job] Rent generation scheduled at 01:00 daily');
};
