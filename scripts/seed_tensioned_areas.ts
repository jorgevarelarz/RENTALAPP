import mongoose from 'mongoose';
import { upsertTensionedArea } from '../src/modules/rentalPublic';

async function main() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/rental-app';
  await mongoose.connect(mongoUrl);

  const now = new Date();
  const areas = [
    {
      region: 'galicia',
      city: 'oleiros',
      zoneCode: '',
      source: 'seed',
      effectiveFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const area of areas) {
    await upsertTensionedArea(area);
  }

  console.log('Seeded tensioned areas:', areas.length);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
