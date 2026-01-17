import fs from 'fs';
import mongoose from 'mongoose';
import { upsertTensionedArea } from '../src/modules/rentalPublic';

type Geometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
};

type Feature = {
  type: 'Feature';
  geometry?: Geometry | null;
  properties?: Record<string, unknown> | null;
};

type FeatureCollection = {
  type: 'FeatureCollection';
  features: Feature[];
};

function getArg(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function toLowerString(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

async function main() {
  const file = getArg('--file') || process.argv[2];
  if (!file) {
    console.error('Usage: ts-node scripts/import_tensioned_geojson.ts --file path/to/file.geojson');
    process.exit(1);
  }

  const source = getArg('--source') || 'geojson';
  const effectiveFromInput = getArg('--effective-from') || new Date().toISOString();
  const effectiveToInput = getArg('--effective-to');
  const areaKeyField = getArg('--area-key-field') || 'areaKey';
  const regionField = getArg('--region-field') || 'region';
  const cityField = getArg('--city-field') || 'city';
  const zoneField = getArg('--zone-field') || 'zoneCode';
  const active = (getArg('--active') || 'true').toLowerCase() !== 'false';

  const raw = fs.readFileSync(file, 'utf-8');
  const parsed = JSON.parse(raw) as FeatureCollection;
  if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    throw new Error('Invalid GeoJSON FeatureCollection');
  }

  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/rental-app';
  await mongoose.connect(mongoUrl);

  let imported = 0;
  let skipped = 0;

  for (const feature of parsed.features) {
    const geometry = feature.geometry || null;
    if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) {
      skipped += 1;
      continue;
    }

    const props = (feature.properties || {}) as Record<string, unknown>;
    const areaKey = toLowerString(props[areaKeyField]);
    const areaKeyParts = areaKey ? areaKey.split('|') : [];
    const region = toLowerString(props[regionField]) || areaKeyParts[0] || '';
    const city = toLowerString(props[cityField]) || areaKeyParts[1] || undefined;
    const zoneCode = toLowerString(props[zoneField]) || areaKeyParts[2] || undefined;

    if (!region) {
      skipped += 1;
      continue;
    }

    await upsertTensionedArea({
      region,
      city,
      zoneCode,
      areaKey: areaKey || undefined,
      source,
      geometry,
      effectiveFrom: new Date(effectiveFromInput),
      effectiveTo: effectiveToInput ? new Date(effectiveToInput) : undefined,
      active,
    });
    imported += 1;
  }

  console.log(`Imported: ${imported}, skipped: ${skipped}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
