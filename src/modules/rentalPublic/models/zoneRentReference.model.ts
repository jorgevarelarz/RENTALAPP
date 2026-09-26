import { Schema, model, Document } from 'mongoose';

/**
 * Official reference rent (€/m² per month) for a municipality, used when the
 * platform does not yet hold enough listings of its own to build an average.
 */
export interface IZoneRentReference extends Document {
  areaKey: string;
  region: string;
  city: string;
  pricePerM2: number;
  /** Normalised spellings of the municipality (bilingual names, "Coruña, A" → "a coruna"). */
  cityKeys?: string[];
  /** Normalised spellings of its autonomous community and province, used to break ties. */
  regionKeys?: string[];
  province?: string;
  ineCode?: string;
  /** Contracts behind the median, as published by the source. */
  sampleSize?: number;
  housingType?: 'collective' | 'single_family';
  /** The source's own median before any percentile choice or update, kept for reference. */
  officialMedianPerM2?: number;
  /** Percentile of the source distribution behind pricePerM2 (50 = median). */
  percentile?: number;
  /** Multiplier applied to bring the source year up to `indexedTo`, and the series it came from. */
  updateFactor?: number;
  updateSeries?: string;
  indexedTo?: string;
  source: string;
  period?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const zoneRentReferenceSchema = new Schema<IZoneRentReference>(
  {
    areaKey: { type: String, required: true, index: true },
    region: { type: String, required: true, lowercase: true, trim: true },
    city: { type: String, required: true, lowercase: true, trim: true },
    pricePerM2: { type: Number, required: true, min: 0 },
    cityKeys: { type: [String], default: undefined, index: true },
    regionKeys: { type: [String], default: undefined },
    province: { type: String },
    ineCode: { type: String },
    sampleSize: { type: Number },
    housingType: { type: String, enum: ['collective', 'single_family'] },
    officialMedianPerM2: { type: Number },
    percentile: { type: Number },
    updateFactor: { type: Number },
    updateSeries: { type: String },
    indexedTo: { type: String },
    source: { type: String, required: true },
    period: { type: String },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

zoneRentReferenceSchema.index({ areaKey: 1, effectiveFrom: -1 });

export function zoneAreaKey(region: unknown, city: unknown) {
  return `${String(region || '').trim().toLowerCase()}|${String(city || '').trim().toLowerCase()}`;
}

/** Lowercase, accent-free, punctuation collapsed: "Rivas-Vaciamadrid" → "rivas vaciamadrid". */
export function normalizePlaceName(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Official gazetteers put the article last ("Rozas de Madrid, Las"); people put it first.
const TRAILING_ARTICLE = /^(.+),\s*(el|la|los|las|l'|lo|els|les|a|o|os|as|es|sa|ses|s')$/i;

// Former Spanish spellings still in everyday use, pointing at the official name.
const PLACE_EXONYMS: Record<string, string> = {
  orense: 'ourense',
  gerona: 'girona',
  lerida: 'lleida',
  vitoria: 'vitoria gasteiz',
  gasteiz: 'vitoria gasteiz',
  'palma de mallorca': 'palma',
  ibiza: 'eivissa',
  mahon: 'mao',
  jativa: 'xativa',
  sangenjo: 'sanxenxo',
  'villagarcia de arosa': 'vilagarcia de arousa',
  mondragon: 'arrasate',
  fuenterrabia: 'hondarribia',
  guecho: 'getxo',
  bilbo: 'bilbao',
};

/**
 * Every normalised spelling a place is likely to be typed as: each half of a
 * bilingual name, with the article in front and without it. The same function
 * runs over the stored names and over the user's input, so both sides agree.
 */
export function placeNameVariants(value: unknown): string[] {
  const variants = new Set<string>();
  for (const part of String(value || '').split(/\s*(?:\/| - )\s*/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const trailing = trimmed.match(TRAILING_ARTICLE);
    const bare = trailing ? trailing[1] : trimmed;
    const full = trailing ? `${trailing[2]}${trailing[2].endsWith("'") ? '' : ' '}${trailing[1]}` : trimmed;
    const leading = full.match(/^(?:(?:el|la|los|las|lo|els|les|a|o|os|as|es|sa|ses)\s+|[ls]'\s*)(.+)$/i);
    for (const candidate of [full, bare, leading ? leading[1] : '']) {
      const normalised = normalizePlaceName(candidate);
      if (normalised) variants.add(normalised);
    }
  }
  for (const variant of [...variants]) {
    if (PLACE_EXONYMS[variant]) variants.add(PLACE_EXONYMS[variant]);
  }
  return [...variants];
}

/** "Rozas de Madrid, Las" → "Las Rozas de Madrid"; bilingual names keep their first form. */
export function displayPlaceName(value: unknown) {
  const first = String(value || '').split(/\s*(?:\/| - )\s*/)[0].trim();
  const trailing = first.match(TRAILING_ARTICLE);
  if (!trailing) return first;
  const article = trailing[2].charAt(0).toUpperCase() + trailing[2].slice(1).toLowerCase();
  return article.endsWith("'") ? `${article}${trailing[1]}` : `${article} ${trailing[1]}`;
}

/** Autonomous communities keyed as the app stores them, with the spellings users and geocoders produce. */
export const REGION_ALIASES: Record<string, string[]> = {
  andalucia: ['andalucia'],
  aragon: ['aragon'],
  asturias: ['asturias', 'principado de asturias'],
  'illes balears': ['illes balears', 'islas baleares', 'baleares', 'balears'],
  canarias: ['canarias', 'islas canarias'],
  cantabria: ['cantabria'],
  'castilla y leon': ['castilla y leon'],
  'castilla-la mancha': ['castilla la mancha'],
  catalunya: ['catalunya', 'cataluna', 'catalonia'],
  'comunitat valenciana': ['comunitat valenciana', 'comunidad valenciana', 'valenciana', 'pais valencia'],
  extremadura: ['extremadura'],
  galicia: ['galicia', 'galiza'],
  madrid: ['madrid', 'comunidad de madrid'],
  murcia: ['murcia', 'region de murcia'],
  navarra: ['navarra', 'nafarroa', 'comunidad foral de navarra'],
  'pais vasco': ['pais vasco', 'euskadi', 'euskal herria'],
  'la rioja': ['la rioja', 'rioja'],
  ceuta: ['ceuta'],
  melilla: ['melilla'],
};

/** INE province code → autonomous community key above. */
export const PROVINCE_REGION: Record<string, string> = {
  '01': 'pais vasco', '02': 'castilla-la mancha', '03': 'comunitat valenciana', '04': 'andalucia',
  '05': 'castilla y leon', '06': 'extremadura', '07': 'illes balears', '08': 'catalunya',
  '09': 'castilla y leon', '10': 'extremadura', '11': 'andalucia', '12': 'comunitat valenciana',
  '13': 'castilla-la mancha', '14': 'andalucia', '15': 'galicia', '16': 'castilla-la mancha',
  '17': 'catalunya', '18': 'andalucia', '19': 'castilla-la mancha', '20': 'pais vasco',
  '21': 'andalucia', '22': 'aragon', '23': 'andalucia', '24': 'castilla y leon',
  '25': 'catalunya', '26': 'la rioja', '27': 'galicia', '28': 'madrid',
  '29': 'andalucia', '30': 'murcia', '31': 'navarra', '32': 'galicia',
  '33': 'asturias', '34': 'castilla y leon', '35': 'canarias', '36': 'galicia',
  '37': 'castilla y leon', '38': 'canarias', '39': 'cantabria', '40': 'castilla y leon',
  '41': 'andalucia', '42': 'castilla y leon', '43': 'catalunya', '44': 'aragon',
  '45': 'castilla-la mancha', '46': 'comunitat valenciana', '47': 'castilla y leon', '48': 'pais vasco',
  '49': 'castilla y leon', '50': 'aragon', '51': 'ceuta', '52': 'melilla',
};

/** Keys a reference answers to on the region side: its community's aliases plus its province. */
export function regionKeysFor(region: unknown, province?: unknown) {
  const key = String(region || '').trim().toLowerCase();
  const keys = new Set<string>([normalizePlaceName(key), ...(REGION_ALIASES[key] || [])]);
  for (const variant of placeNameVariants(province)) keys.add(variant);
  keys.delete('');
  return [...keys];
}

zoneRentReferenceSchema.pre('validate', function setAreaKey(next) {
  this.areaKey = zoneAreaKey(this.region, this.city);
  if (!this.cityKeys?.length) this.cityKeys = placeNameVariants(this.city);
  if (!this.regionKeys?.length) this.regionKeys = regionKeysFor(this.region, this.province);
  next();
});

export const ZoneRentReference = model<IZoneRentReference>('ZoneRentReference', zoneRentReferenceSchema);
