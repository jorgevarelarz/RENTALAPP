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

zoneRentReferenceSchema.pre('validate', function setAreaKey(next) {
  this.areaKey = zoneAreaKey(this.region, this.city);
  next();
});

export const ZoneRentReference = model<IZoneRentReference>('ZoneRentReference', zoneRentReferenceSchema);
