import { Schema, model, Types } from 'mongoose';

const ServiceClickSchema = new Schema(
  {
    userId: { type: Types.ObjectId, index: true },
    contractId: { type: Types.ObjectId, index: true },
    serviceId: { type: Types.ObjectId, index: true },
    ts: { type: Date, default: Date.now },
  },
  { collection: 'service_clicks' },
);

export const ServiceClick = model('ServiceClick', ServiceClickSchema);

