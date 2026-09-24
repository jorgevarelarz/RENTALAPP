import fs from 'fs';
import mongoose from 'mongoose';
import {
  PROVINCE_REGION,
  ZoneRentReference,
  displayPlaceName,
  placeNameVariants,
  regionKeysFor,
  zoneAreaKey,
} from '../src/modules/rentalPublic/models/zoneRentReference.model';

/**
 * Loads the SERPAVI municipal reference rent produced by
 * scripts/serpavi_extract.py (TSV: ineCode, officialName, province,
 * medianPerM2, p75PerM2, housingType, sampleSize, period).
 *
 * SERPAVI describes every contract in force, old ones included, so its median
 * sits well below what a new tenancy fetches. --percentile 75 takes the upper
 * quartile instead, and --factors (scripts/ine_rent_update.py) carries the
 * figure from the SERPAVI year to the latest INE month for its region.
 *
 * Re-running with the same --from updates in place; a newer --from adds a new
 * vintage and the suggestion always reads the most recent effective one.
 *
 * Usage:
 *   npx ts-node scripts/import_serpavi.ts --file serpavi-2024.tsv \
 *     --source "MIVAU SERPAVI 2011-2024" --from 2026-03-09 \
 *     [--percentile 50|75] [--factors ine-factors.json] [--dry-run]
 */

function getArg(flag: string) {
  const idx = process.argv.indexOf(flag);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

const MONTHS = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];

/** Shown to the landlord next to the suggestion, e.g. "SERPAVI 2024, cuartil alto, actualizado con el IPC a ago. 2026". */
function describePeriod(year: string, percentile: number, indexedTo?: string) {
  const parts = [`SERPAVI ${year}`];
  if (percentile === 75) parts.push('cuartil alto');
  if (indexedTo) {
    const [y, m] = indexedTo.split('-');
    parts.push(`actualizado con el IPC a ${MONTHS[Number(m) - 1]} ${y}`);
  }
  return parts.join(', ');
}

async function main() {
  const file = getArg('--file');
  const source = getArg('--source');
  const from = getArg('--from');
  const dryRun = process.argv.includes('--dry-run');
  const percentile = Number(getArg('--percentile') || 50);
  if (![50, 75].includes(percentile)) throw new Error('--percentile must be 50 or 75');
  const factorsFile = getArg('--factors');
  const factors: Record<string, { factor: number; series: string; to: string }> = factorsFile
    ? JSON.parse(fs.readFileSync(factorsFile, 'utf8'))
    : {};
  if (!file || !source || !from) {
    throw new Error('Usage: --file <tsv> --source <label> --from YYYY-MM-DD [--dry-run]');
  }
  const effectiveFrom = new Date(from);
  if (Number.isNaN(effectiveFrom.getTime())) throw new Error(`Invalid --from date: ${from}`);

  const [header, ...rows] = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line.trim());
  const columns = header.split('\t');
  const at = (name: string) => {
    const idx = columns.indexOf(name);
    if (idx === -1) throw new Error(`Column ${name} missing from ${file}`);
    return idx;
  };
  const idx = {
    ineCode: at('ineCode'), officialName: at('officialName'), province: at('province'),
    medianPerM2: at('medianPerM2'), p75PerM2: at('p75PerM2'), housingType: at('housingType'), sampleSize: at('sampleSize'), period: at('period'),
  };

  const docs = [];
  let skipped = 0;
  for (const row of rows) {
    const cells = row.split('\t');
    const ineCode = cells[idx.ineCode];
    const region = PROVINCE_REGION[ineCode.slice(0, 2)];
    const officialMedianPerM2 = Number(cells[idx.medianPerM2]);
    const base = Number(cells[percentile === 75 ? idx.p75PerM2 : idx.medianPerM2]);
    const update = factorsFile ? factors[region] : undefined;
    if (factorsFile && !update) throw new Error(`No update factor for region ${region}`);
    const pricePerM2 = Math.round(base * (update?.factor ?? 1) * 100) / 100;
    if (!region || !Number.isFinite(pricePerM2) || pricePerM2 <= 0) {
      skipped += 1;
      continue;
    }
    const officialName = cells[idx.officialName];
    const province = cells[idx.province];
    const city = displayPlaceName(officialName);
    docs.push({
      areaKey: zoneAreaKey(region, city),
      region,
      city: city.toLowerCase(),
      cityKeys: placeNameVariants(officialName),
      regionKeys: regionKeysFor(region, province),
      province,
      ineCode,
      pricePerM2,
      officialMedianPerM2,
      percentile,
      updateFactor: update?.factor,
      updateSeries: update ? `INE ${update.series}` : undefined,
      indexedTo: update?.to,
      housingType: cells[idx.housingType],
      sampleSize: Number(cells[idx.sampleSize]) || undefined,
      period: describePeriod(cells[idx.period], percentile, update?.to),
      source,
      effectiveFrom,
      active: true,
    });
  }

  console.log(`${docs.length} municipalities parsed (skipped ${skipped}).`);
  for (const sample of docs.filter(doc => ['15030', '28079', '03014', '20069'].includes(doc.ineCode))) {
    console.log(`  ${sample.ineCode} ${sample.city} (${sample.region}) ${sample.officialMedianPerM2} → ${sample.pricePerM2} €/m² [${sample.period}]`);
  }
  if (dryRun) return;

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);
  await ZoneRentReference.syncIndexes();
  const result = await ZoneRentReference.bulkWrite(
    docs.map(doc => ({
      updateOne: {
        filter: { ineCode: doc.ineCode, effectiveFrom },
        update: { $set: doc },
        upsert: true,
      },
    })),
  );
  console.log(`Upserted ${result.upsertedCount}, updated ${result.modifiedCount}.`);
  await mongoose.disconnect();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
