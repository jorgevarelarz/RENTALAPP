import fs from 'fs';
import mongoose from 'mongoose';
import { PROVINCE_REGION, REGION_ALIASES, ZoneRentReference, normalizePlaceName, placeNameVariants, regionKeysFor, zoneAreaKey } from '../src/modules/rentalPublic/models/zoneRentReference.model';

/**
 * Imports municipal reference rents from a simple CSV (no embedded commas):
 * region,city,pricePerM2[,period,ineCode,sampleSize]
 *
 * Validate every row before connecting. --dry-run never opens a database.
 * See docs/galicia-rent-reference.md for the sourced IGVS dataset and commands.
 */
function getArg(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function splitCsvLine(line: string) {
  // ponytail: simple CSV only; use a CSV parser if a source needs embedded commas.
  return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
}

export function parseReferences(csv: string, source: string, effectiveFrom: Date) {
  if (!source.trim() || Number.isNaN(effectiveFrom.getTime())) {
    throw new Error('A source and a valid effective date are required');
  }
  const [header, ...rows] = csv.split(/\r?\n/).filter(line => line.trim());
  if (!header || !rows.length) throw new Error('CSV must contain a header and at least one reference');
  const columns = splitCsvLine(header).map(name => name.toLowerCase());
  const regionIdx = columns.indexOf('region');
  const cityIdx = columns.indexOf('city');
  const priceIdx = columns.findIndex(name => ['priceperm2', 'pricepersqm', 'eurm2'].includes(name));
  const periodIdx = columns.indexOf('period');
  const codeIdx = columns.indexOf('inecode');
  const sampleIdx = columns.indexOf('samplesize');
  if (regionIdx === -1 || cityIdx === -1 || priceIdx === -1) {
    throw new Error('CSV header must contain: region, city, pricePerM2');
  }

  // Compara sin tildes ni guiones y acepta alias ("Castilla y León", "Comunidad de Madrid")
  const regionMatchesProvince = (region: string, ineCode: string) => {
    const expected = PROVINCE_REGION[ineCode.slice(0, 2)];
    if (!expected) return false;
    return [normalizePlaceName(expected), ...(REGION_ALIASES[expected] || [])].includes(normalizePlaceName(region));
  };

  const seen = new Set<string>();
  return rows.map((row, index) => {
    const cells = splitCsvLine(row);
    const region = cells[regionIdx]?.toLowerCase();
    const city = cells[cityIdx]?.toLowerCase();
    const pricePerM2 = Number(cells[priceIdx]);
    const ineCode = codeIdx >= 0 ? cells[codeIdx] : undefined;
    const sampleSize = sampleIdx >= 0 ? Number(cells[sampleIdx]) : undefined;
    if (cells.length !== columns.length || !region || !city || !Number.isFinite(pricePerM2) || pricePerM2 <= 0 ||
        (codeIdx >= 0 && (!ineCode || !/^\d{5}$/.test(ineCode) || !regionMatchesProvince(region, ineCode))) ||
        (sampleSize !== undefined && (!Number.isInteger(sampleSize) || sampleSize <= 0))) {
      throw new Error(`Invalid reference at CSV row ${index + 2}`);
    }
    const areaKey = zoneAreaKey(region, city);
    const key = ineCode || areaKey;
    if (seen.has(key) || seen.has(areaKey)) throw new Error(`Duplicate reference at CSV row ${index + 2}`);
    seen.add(key);
    seen.add(areaKey);
    return {
      areaKey, region, city, pricePerM2, ineCode, sampleSize,
      cityKeys: placeNameVariants(city),
      regionKeys: regionKeysFor(region),
      source,
      period: periodIdx >= 0 ? cells[periodIdx] : undefined,
      effectiveFrom,
      active: true,
    };
  });
}

async function main() {
  const file = getArg('--file');
  const source = getArg('--source');
  const from = getArg('--from');
  if (!file || !source || !from) {
    throw new Error('Usage: --file <csv> --source <label> --from YYYY-MM-DD [--dry-run]');
  }
  const docs = parseReferences(fs.readFileSync(file, 'utf8'), source, new Date(from));
  if (process.argv.includes('--dry-run')) {
    console.log(JSON.stringify(docs, null, 2));
    return;
  }
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  try {
    await mongoose.connect(uri);
    const result = await ZoneRentReference.bulkWrite(docs.map(doc => ({
      updateOne: {
        filter: { areaKey: doc.areaKey, effectiveFrom: doc.effectiveFrom },
        update: { $set: doc },
        upsert: true,
      },
    })));
    console.log(`Imported ${docs.length} municipalities: ${result.upsertedCount} added, ${result.modifiedCount} updated.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
