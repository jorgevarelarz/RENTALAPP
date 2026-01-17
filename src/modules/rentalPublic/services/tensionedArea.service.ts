import { TensionedArea } from '../models/tensionedArea.model';
import { buildAreaKey } from '../complianceValidation.service';

export type TensionedAreaInput = {
  region: string;
  city?: string;
  zoneCode?: string;
  source: string;
  maxRent?: number;
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
  active?: boolean;
  areaKey?: string;
};

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export async function upsertTensionedArea(input: TensionedAreaInput) {
  const areaKey = (input.areaKey || buildAreaKey(input.region, input.city, input.zoneCode))
    .trim()
    .toLowerCase();
  const effectiveFrom = toDate(input.effectiveFrom);
  const effectiveTo = input.effectiveTo ? toDate(input.effectiveTo) : undefined;
  const now = new Date();
  const active =
    typeof input.active === 'boolean'
      ? input.active
      : effectiveFrom <= now && (!effectiveTo || effectiveTo >= now);
  const geometry = input.geometry;
  const maxRent = input.maxRent;

  const endBoundary = effectiveTo ?? new Date('9999-12-31T00:00:00.000Z');
  const overlapQuery = {
    areaKey,
    active: true,
    effectiveFrom: { $lte: endBoundary },
    $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: effectiveFrom } }],
  };

  const existing = await TensionedArea.findOne(overlapQuery).sort({ effectiveFrom: -1 });
  const payload: Record<string, unknown> = {
    areaKey,
    region: input.region,
    city: input.city,
    zoneCode: input.zoneCode,
    source: input.source,
    ...(typeof maxRent === 'number' ? { maxRent } : {}),
    effectiveFrom,
    effectiveTo,
    active,
    ...(geometry ? { geometry } : {}),
  };

  if (existing) {
    existing.set(payload);
    await existing.save();
    return existing;
  }

  return TensionedArea.create(payload);
}
