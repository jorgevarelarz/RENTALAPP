import cron from 'node-cron';
import { Contract } from '../models/contract.model';
import { Payment } from '../models/payment.model';
import { recordContractHistory } from '../utils/history';

export const runRentGeneration = async () => {
  console.log('[Job] Starting rent generation');
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  try {
    const contracts = await Contract.find({ status: 'active' });
    let count = 0;

    for (const contract of contracts) {
      const exists = await Payment.findOne({
        contract: contract._id,
        type: 'rent',
        billingMonth: currentMonth,
        billingYear: currentYear,
      }).lean();

      if (exists) continue;

      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 5);

      await Payment.create({
        contract: contract._id,
        payer: contract.tenant,
        payee: contract.landlord,
        amount: contract.rent ?? (contract as any).rentAmount ?? 0,
        currency: contract.currency || 'eur',
        status: 'pending',
        type: 'rent',
        concept: `Renta ${now.toLocaleString('es-ES', { month: 'long' })} ${currentYear}`,
        billingMonth: currentMonth,
        billingYear: currentYear,
        dueDate,
      });

      await recordContractHistory(
        contract.id,
        'rent_generated',
        `Recibo generado para ${currentMonth}/${currentYear}`,
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
