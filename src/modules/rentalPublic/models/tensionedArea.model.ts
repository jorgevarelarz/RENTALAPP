import { Schema, model, Document } from 'mongoose';

export interface ITensionedArea extends Document {
  areaKey: string;
  region: string;
  city?: string;
  zoneCode?: string;
  source: string;
  maxRent?: number;
  geometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  effectiveFrom: Date;
  effectiveTo?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const tensionedAreaSchema = new Schema<ITensionedArea>(
  {
    areaKey: { type: String, required: true, index: true },
    region: { type: String, required: true },
    city: { type: String },
    zoneCode: { type: String },
    source: { type: String, required: true },
    maxRent: { type: Number, min: 0 },
    geometry: {
      type: {
        type: String,
        enum: ['Polygon', 'MultiPolygon'],
      },
      coordinates: { type: Array },
    },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

tensionedAreaSchema.index({ areaKey: 1, effectiveFrom: -1 });
tensionedAreaSchema.index({ geometry: '2dsphere' });

tensionedAreaSchema.pre('validate', function setAreaKey(next) {
  const region = String(this.region || '').trim().toLowerCase();
  const city = String(this.city || '').trim().toLowerCase();
  const zone = String(this.zoneCode || '').trim().toLowerCase();
  this.areaKey = `${region}|${city}|${zone}`;
  next();
});

export const TensionedArea = model<ITensionedArea>('TensionedArea', tensionedAreaSchema);
