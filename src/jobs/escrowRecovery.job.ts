import cron from 'node-cron';
import { resumeStuckEscrowReleases } from '../services/ticketEscrow.service';

export const runEscrowRecovery = async () => {
  try {
    const { found, completed, failed } = await resumeStuckEscrowReleases();
    if (!found) return;
    console.log(`[Job] Liberaciones de escrow a medias: ${found}, completadas ${completed}`);
    for (const f of failed) {
      // Sigue en releasing y se reintenta en la próxima pasada; si persiste, hay que mirarlo a mano
      console.error(`[Job] ALERTA escrow ${f.escrowId} sin poder liberar: ${f.error}`);
    }
  } catch (error) {
    console.error('[Job] Error en la recuperación de escrows:', error);
  }
};

export const startEscrowRecoveryJob = () => {
  // Cada 5 minutos: termina las liberaciones que se cortaron (proceso caído, error de BD)
  cron.schedule('*/5 * * * *', runEscrowRecovery);
  console.log('[Job] Recuperación de escrows programada cada 5 minutos');
};
