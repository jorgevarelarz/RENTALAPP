import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseReferences } from '../../scripts/import_zone_rent_reference';
import { ZoneRentReference } from '../../src/modules/rentalPublic/models/zoneRentReference.model';
import { suggestRent } from '../../src/services/rentSuggestion.service';
import { connectDb, disconnectDb, clearDb } from '../utils/db';

const file = 'scripts/data/igvs-cities-2026-q2.csv';
const source = 'IGVS Observatorio de Vivenda';
const date = new Date('2026-08-13');

beforeAll(connectDb);
afterAll(disconnectDb);
afterEach(clearDb);

it('rejects unusable references before any database write', () => {
  for (const row of ['galicia,Vigo,NaN', 'galicia,Vigo,0', 'galicia,,7.7']) {
    expect(() => parseReferences(`region,city,pricePerM2\n${row}`, source, date)).toThrow();
  }
  expect(() => parseReferences('region,city,pricePerM2,ineCode\ngalicia,Vigo,7.7,28079', source, date)).toThrow();
  expect(() => parseReferences('region,city,pricePerM2\ngalicia,Vigo,7.7\ngalicia,Vigo,8', source, date)).toThrow();
  expect(() => parseReferences('', source, date)).toThrow();
});

it('imports all seven IGVS cities idempotently and prefers them to older SERPAVI references for aliases too', async () => {
  const docs = parseReferences(fs.readFileSync(file, 'utf8'), source, date);
  expect(docs).toHaveLength(7);
  expect(docs.reduce((n, doc) => n + (doc.sampleSize || 0), 0)).toBe(4104);
  await ZoneRentReference.insertMany(docs.map(doc => ({
    ...doc, pricePerM2: 30, source: 'SERPAVI', effectiveFrom: new Date('2026-03-09'),
  })));
  const args = ['-r', 'ts-node/register/transpile-only', 'scripts/import_zone_rent_reference.ts',
    '--file', file, '--source', source, '--from', '2026-08-13'];
  const env = { ...process.env, MONGO_URI: process.env.MONGO_URL };
  await promisify(execFile)(process.execPath, [...args, '--dry-run'], { env });
  expect(await ZoneRentReference.countDocuments()).toBe(7);
  await promisify(execFile)(process.execPath, args, { env });
  await promisify(execFile)(process.execPath, args, { env });
  expect(await ZoneRentReference.countDocuments()).toBe(14);

  for (const doc of docs) {
    const suggestion = await suggestRent({ region: 'Galiza', city: doc.city, sizeM2: 100 });
    expect(suggestion?.basis.reference?.source).toBe(source);
    expect(suggestion?.basePricePerM2).toBe(doc.pricePerM2);
  }
  expect((await suggestRent({ region: 'galicia', city: 'Orense', sizeM2: 100 }))?.suggested).toBe(640);
  expect((await suggestRent({ region: 'galicia', city: 'A Coruña', sizeM2: 100 }))?.suggested).toBe(790);
});
