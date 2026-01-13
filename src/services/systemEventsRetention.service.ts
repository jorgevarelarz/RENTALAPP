import { SystemEvent } from '../models/systemEvent.model';
import { emitSystemEvent } from '../events/system.events';

export async function runSystemEventsRetention(retentionDays: number) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return { deletedCount: 0, retentionDays };
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const result = await SystemEvent.deleteMany({ createdAt: { $lt: cutoff } });
  const deletedCount = result.deletedCount || 0;

  const payload = {
    type: 'SYSTEM_EVENTS_RETENTION_RUN',
    resourceType: 'system',
    resourceId: cutoff.toISOString(),
    payload: {
      retentionDays,
      cutoff: cutoff.toISOString(),
      deletedCount,
    },
  };

  try {
    await SystemEvent.create(payload);
    emitSystemEvent({ ...payload, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error('Error logging retention event:', err);
  }

  return { deletedCount, retentionDays, cutoff };
}
