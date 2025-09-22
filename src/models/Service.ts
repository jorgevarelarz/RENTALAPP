import { Schema, model } from 'mongoose';

const ServiceSchema = new Schema(
  {
    name: String,
    type: { type: String, enum: ['energy', 'internet', 'insurance', 'pro'] },
    logo: String,
    url: String,
    description: String,
    priority: { type: Number, default: 100 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'services' },
);

export const Service = model('Service', ServiceSchema);

