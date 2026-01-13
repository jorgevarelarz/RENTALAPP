import mongoose from 'mongoose';
import { runSystemEventsRetention } from '../src/services/systemEventsRetention.service';

async function main() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/rental-app';
  const rawDays = process.env.SYSTEM_EVENTS_RETENTION_DAYS;

  if (!rawDays) {
    console.log('SYSTEM_EVENTS_RETENTION_DAYS not set. Skipping cleanup.');
    return;
  }

  const retentionDays = Number(rawDays);
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    throw new Error('SYSTEM_EVENTS_RETENTION_DAYS must be a positive number');
  }

  await mongoose.connect(mongoUrl);
  const result = await runSystemEventsRetention(retentionDays);
  console.log('System events retention completed:', {
    retentionDays: result.retentionDays,
    deletedCount: result.deletedCount,
    cutoff: result.cutoff?.toISOString?.(),
  });
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
