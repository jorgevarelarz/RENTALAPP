import cron from 'node-cron';
import { upsertLatestLauDocument } from '../services/legalDocuments.service';

export const runLauUpdate = async () => {
  try {
    const result = await upsertLatestLauDocument();
    const status = result.updated ? 'actualizada' : 'sin cambios';
    console.log(`[Job] LAU: ${status}.`);
  } catch (error: any) {
    console.error('[Job] Error actualizando LAU:', error?.message || error);
  }
};

export const startLauUpdateJob = () => {
  // Diario a las 03:15 AM (hora del servidor)
  cron.schedule('15 3 * * *', runLauUpdate);
  console.log('Tarea de actualización LAU programada (03:15 AM diaria).');
};
