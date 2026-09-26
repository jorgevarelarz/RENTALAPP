import { Property } from '../models/property.model';
import { TensionedArea } from '../modules/rentalPublic/models/tensionedArea.model';
import {
  REGION_ALIASES,
  ZoneRentReference,
  placeNameVariants,
  zoneAreaKey,
} from '../modules/rentalPublic/models/zoneRentReference.model';

const KNOWN_REGION_KEYS = new Set(Object.values(REGION_ALIASES).flat());

export type PropertyCondition = 'obra_nueva' | 'reformado' | 'buen_estado' | 'a_reformar';

export type SuggestionInput = {
  region: string;
  city: string;
  sizeM2: number;
  location?: { lat: number; lng: number };
  condition?: PropertyCondition;
  furnished?: boolean;
  floor?: number;
  hasElevator?: boolean;
  yearBuilt?: number;
  excludePropertyId?: string;
};

export type SuggestionAdjustment = { key: string; label: string; factor: number };

export type RentSuggestion = {
  suggested: number;
  range: { min: number; max: number };
  pricePerM2: number;
  basePricePerM2: number;
  adjustments: SuggestionAdjustment[];
  basis: {
    source: 'own_listings' | 'official_reference';
    sampleSize: number;
    radiusKm?: number;
    scope: 'radius' | 'city' | 'municipality';
    reference?: { source: string; period?: string };
  };
  cap?: { maxRent: number; applied: boolean; areaKey: string };
};

/** Minimum comparable listings before we trust our own market data over the official index. */
export const MIN_OWN_COMPARABLES = 5;
const SEARCH_RADII_KM = [2, 5, 10];
const EARTH_RADIUS_KM = 6378.1;
/** Guard rails so a pile of adjustments can never run away from the zone price. */
const MIN_TOTAL_FACTOR = 0.75;
const MAX_TOTAL_FACTOR = 1.25;
const RANGE_SPREAD = 0.08;

const CONDITION_FACTORS: Record<PropertyCondition, number> = {
  obra_nueva: 1.1,
  reformado: 1.05,
  buen_estado: 1,
  a_reformar: 0.88,
};

const CONDITION_LABELS: Record<PropertyCondition, string> = {
  obra_nueva: 'Obra nueva',
  reformado: 'Reformado',
  buen_estado: 'Buen estado',
  a_reformar: 'A reformar',
};

/**
 * Mean of the sample after discarding the extremes, so a single mispriced
 * listing cannot drag the whole zone average.
 */
export function trimmedMean(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const cut = sorted.length >= 8 ? Math.floor(sorted.length * 0.1) : 0;
  const kept = cut > 0 ? sorted.slice(cut, sorted.length - cut) : sorted;
  return kept.reduce((acc, value) => acc + value, 0) / kept.length;
}

export function buildAdjustments(input: SuggestionInput): SuggestionAdjustment[] {
  const adjustments: SuggestionAdjustment[] = [];
  const condition = input.condition || 'buen_estado';

  if (CONDITION_FACTORS[condition] !== 1) {
    adjustments.push({
      key: 'condition',
      label: CONDITION_LABELS[condition],
      factor: CONDITION_FACTORS[condition],
    });
  }
  if (input.furnished) {
    adjustments.push({ key: 'furnished', label: 'Amueblado', factor: 1.05 });
  }
  if (typeof input.floor === 'number') {
    if (input.floor === 0) {
      adjustments.push({ key: 'floor', label: 'Planta baja', factor: 0.97 });
    } else if (input.floor >= 3 && input.hasElevator === false) {
      adjustments.push({ key: 'elevator', label: 'Planta alta sin ascensor', factor: 0.94 });
    } else if (input.floor >= 1 && input.hasElevator === true) {
      adjustments.push({ key: 'elevator', label: 'Planta alta con ascensor', factor: 1.02 });
    }
  }
  if (typeof input.yearBuilt === 'number') {
    if (input.yearBuilt < 1980) {
      adjustments.push({ key: 'yearBuilt', label: 'Edificio anterior a 1980', factor: 0.97 });
    } else if (input.yearBuilt >= 2010) {
      adjustments.push({ key: 'yearBuilt', label: 'Edificio reciente', factor: 1.03 });
    }
  }
  return adjustments;
}

export function totalFactor(adjustments: SuggestionAdjustment[]) {
  const raw = adjustments.reduce((acc, adjustment) => acc * adjustment.factor, 1);
  return Math.min(MAX_TOTAL_FACTOR, Math.max(MIN_TOTAL_FACTOR, raw));
}

function roundToTen(value: number) {
  return Math.round(value / 10) * 10;
}

type Comparable = { pricePerM2: number };

async function findOwnComparables(input: SuggestionInput) {
  const baseQuery: Record<string, unknown> = {
    status: 'active',
    sizeM2: { $gt: 0 },
    price: { $gt: 0 },
  };
  if (input.excludePropertyId) {
    baseQuery._id = { $ne: input.excludePropertyId };
  }

  const hasPoint =
    input.location &&
    Number.isFinite(input.location.lat) &&
    Number.isFinite(input.location.lng);

  if (hasPoint) {
    for (const radiusKm of SEARCH_RADII_KM) {
      const docs = await Property.find({
        ...baseQuery,
        location: {
          $geoWithin: {
            $centerSphere: [[input.location!.lng, input.location!.lat], radiusKm / EARTH_RADIUS_KM],
          },
        },
      })
        .select('price sizeM2')
        .lean();

      if (docs.length >= MIN_OWN_COMPARABLES) {
        return { docs, radiusKm, scope: 'radius' as const };
      }
    }
  }

  const docs = await Property.find({
    ...baseQuery,
    city: new RegExp(`^${escapeRegExp(input.city)}$`, 'i'),
  })
    .select('price sizeM2')
    .lean();

  return { docs, radiusKm: undefined, scope: 'city' as const };
}

function escapeRegExp(value: string) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findOfficialReference(input: SuggestionInput) {
  const now = new Date();
  const window = {
    active: true,
    effectiveFrom: { $lte: now },
    $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }],
  };

  const exact = await ZoneRentReference.findOne({ ...window, areaKey: zoneAreaKey(input.region, input.city) })
    .sort({ effectiveFrom: -1 })
    .lean();
  if (exact) return exact;

  // Region and city are free text (or whatever the geocoder returned), so match
  // on normalised spellings: "Alacant", "Las Palmas", "A Coruña" all resolve.
  const cityKeys = placeNameVariants(input.city);
  if (!cityKeys.length) return null;
  const candidates = await ZoneRentReference.find({ ...window, cityKeys: { $in: cityKeys } })
    .sort({ effectiveFrom: -1 })
    .lean();
  const latest = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    const key = candidate.ineCode || candidate.areaKey;
    if (!latest.has(key)) latest.set(key, candidate);
  }
  const places = [...latest.values()];
  if (!places.length) return null;

  const regionKeys = placeNameVariants(input.region);
  const inRegion = regionKeys.length
    ? places.filter(place => (place.regionKeys || []).some(key => regionKeys.includes(key)))
    : [];
  if (inRegion.length === 1) return inRegion[0];
  if (inRegion.length > 1) return null;

  // A region we recognise that matches none of them means a different town with
  // the same name: better no number than another town's price.
  const knownRegion =
    regionKeys.some(key => KNOWN_REGION_KEYS.has(key)) ||
    (regionKeys.length > 0 && (await ZoneRentReference.exists({ regionKeys: { $in: regionKeys } })));
  if (knownRegion) return null;
  return places.length === 1 ? places[0] : null;
}

async function findRentCap(input: SuggestionInput) {
  const now = new Date();
  const window = {
    active: true,
    effectiveFrom: { $lte: now },
    $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }],
  };

  const hasPoint =
    input.location &&
    Number.isFinite(input.location.lat) &&
    Number.isFinite(input.location.lng);

  const byGeometry = hasPoint
    ? await TensionedArea.findOne({
        ...window,
        geometry: {
          $geoIntersects: {
            $geometry: { type: 'Point', coordinates: [input.location!.lng, input.location!.lat] },
          },
        },
      })
        .sort({ effectiveFrom: -1 })
        .lean()
    : null;

  return (
    byGeometry ||
    (await TensionedArea.findOne({
      ...window,
      areaKey: new RegExp(`^${escapeRegExp(zoneAreaKey(input.region, input.city))}\\|`),
    })
      .sort({ effectiveFrom: -1 })
      .lean())
  );
}

/**
 * Suggests a monthly rent from the zone's €/m², adjusted for the state of the
 * home. Returns null when neither our own listings nor the official index can
 * back a number — we would rather show nothing than invent a price.
 */
export async function suggestRent(input: SuggestionInput): Promise<RentSuggestion | null> {
  const sizeM2 = Number(input.sizeM2);
  if (!Number.isFinite(sizeM2) || sizeM2 <= 0) return null;

  const { docs, radiusKm, scope } = await findOwnComparables(input);
  const ownPrices: Comparable[] = docs
    .map((doc: any) => ({ pricePerM2: Number(doc.price) / Number(doc.sizeM2) }))
    .filter(comparable => Number.isFinite(comparable.pricePerM2) && comparable.pricePerM2 > 0);

  let basePricePerM2 = 0;
  let basis: RentSuggestion['basis'] | null = null;

  if (ownPrices.length >= MIN_OWN_COMPARABLES) {
    basePricePerM2 = trimmedMean(ownPrices.map(comparable => comparable.pricePerM2));
    basis = {
      source: 'own_listings',
      sampleSize: ownPrices.length,
      radiusKm,
      scope,
    };
  } else {
    const reference = await findOfficialReference(input);
    if (!reference) return null;
    basePricePerM2 = Number(reference.pricePerM2);
    basis = {
      source: 'official_reference',
      sampleSize: ownPrices.length,
      scope: 'municipality',
      reference: { source: reference.source, period: reference.period },
    };
  }

  if (!Number.isFinite(basePricePerM2) || basePricePerM2 <= 0) return null;

  const adjustments = buildAdjustments(input);
  const factor = totalFactor(adjustments);
  const pricePerM2 = basePricePerM2 * factor;
  let suggested = roundToTen(pricePerM2 * sizeM2);

  const area = await findRentCap(input);
  let cap: RentSuggestion['cap'];
  if (area && typeof area.maxRent === 'number' && area.maxRent > 0) {
    const applied = suggested > area.maxRent;
    if (applied) suggested = roundToTen(area.maxRent);
    cap = { maxRent: area.maxRent, applied, areaKey: area.areaKey };
  }

  // A capped suggestion must not be surrounded by a range that walks back over
  // the legal limit.
  const rangeMax = roundToTen(suggested * (1 + RANGE_SPREAD));

  return {
    suggested,
    range: {
      min: roundToTen(suggested * (1 - RANGE_SPREAD)),
      max: cap ? Math.min(rangeMax, roundToTen(cap.maxRent)) : rangeMax,
    },
    pricePerM2: Math.round(pricePerM2 * 100) / 100,
    basePricePerM2: Math.round(basePricePerM2 * 100) / 100,
    adjustments,
    basis,
    cap,
  };
}
