import cron from 'node-cron';
import { Contract } from '../models/contract.model';
import { transitionContract } from '../services/contractState';
import { recordContractHistory } from '../utils/history';

export const runDailyActivation = async () => {
  console.log('[Job] Iniciando activación automática de contratos...');
  const now = new Date();

  try {
    const contracts = await Contract.find({
      status: 'signed',
      depositPaid: true,
      startDate: { $lte: now },
    });

    if (contracts.length === 0) {
      console.log('[Job] No hay contratos pendientes de activación.');
      return;
    }

    console.log(`[Job] Encontrados ${contracts.length} contratos para activar.`);

    for (const contract of contracts) {
      try {
        await transitionContract(contract.id, 'active');
        await recordContractHistory(
          contract.id,
          'activated_auto_job',
          'Contrato activado automáticamente por tarea programada',
        );
        console.log(`[Job] Contrato ${contract.id} activado correctamente.`);
      } catch (err: any) {
        console.error(`[Job] Error activando contrato ${contract.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[Job] Error fatal en el job de activación:', error);
  }
};

export const startContractActivationJob = () => {
  // Se ejecuta todos los días a las 00:05 AM (hora del servidor)
  cron.schedule('5 0 * * *', runDailyActivation);
  console.log('Tarea de activación de contratos programada (00:05 AM diaria).');
};
