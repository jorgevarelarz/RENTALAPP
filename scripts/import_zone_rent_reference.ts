import fs from 'fs';
import mongoose from 'mongoose';
import { ZoneRentReference, placeNameVariants, regionKeysFor, zoneAreaKey } from '../src/modules/rentalPublic/models/zoneRentReference.model';

/**
 * Loads the official reference rent (€/m² per month) per municipality.
 *
 * The expected CSV has a header and three or four columns:
 *   region,city,pricePerM2[,period]
 *
 * Source: "Sistema estatal de referencia del precio del alquiler de vivienda"
 * (Ministerio de Vivienda y Agenda Urbana). Export the municipalities you need
 * and feed the file here — no figures are bundled with the repo so the data in
 * the database always has a traceable origin.
 *
 * Usage:
 *   npx ts-node scripts/import_zone_rent_reference.ts \
 *     --file data/referencia-2025.csv --source mivau-2025 --from 2025-01-01
 */

function getArg(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function splitCsvLine(line: string) {
  return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
}

async function main() {
  const file = getArg('--file');
  const source = getArg('--source');
  const from = getArg('--from');

  if (!file || !source) {
    throw new Error('Usage: --file <csv> --source <label> [--from YYYY-MM-DD]');
  }
  if (!fs.existsSync(file)) {
    throw new Error(`CSV not found: ${file}`);
  }

  const effectiveFrom = from ? new Date(from) : new Date();
  if (Number.isNaN(effectiveFrom.getTime())) {
    throw new Error(`Invalid --from date: ${from}`);
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);

  const lines = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0);

  const [header, ...rows] = lines;
  const columns = splitCsvLine(header).map(name => name.toLowerCase());
  const regionIdx = columns.indexOf('region');
  const cityIdx = columns.indexOf('city');
  const priceIdx = columns.findIndex(name => ['priceperm2', 'pricepersqm', 'eurm2'].includes(name));
  const periodIdx = columns.indexOf('period');

  if (regionIdx === -1 || cityIdx === -1 || priceIdx === -1) {
    throw new Error('CSV header must contain: region, city, pricePerM2 [, period]');
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const cells = splitCsvLine(row);
    const region = cells[regionIdx];
    const city = cells[cityIdx];
    const pricePerM2 = Number(String(cells[priceIdx]).replace(',', '.'));
    const period = periodIdx >= 0 ? cells[periodIdx] : undefined;

    if (!region || !city || !Number.isFinite(pricePerM2) || pricePerM2 <= 0) {
      skipped += 1;
      continue;
    }

    await ZoneRentReference.findOneAndUpdate(
      { areaKey: zoneAreaKey(region, city), effectiveFrom },
      {
        region: region.toLowerCase(),
        city: city.toLowerCase(),
        cityKeys: placeNameVariants(city),
        regionKeys: regionKeysFor(region),
        pricePerM2,
        source,
        period,
        effectiveFrom,
        active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    imported += 1;
  }

  console.log(`Imported ${imported} municipalities from ${file} (skipped ${skipped}).`);
  await mongoose.disconnect();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
