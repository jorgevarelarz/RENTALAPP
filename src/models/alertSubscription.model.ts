import { Schema, model } from 'mongoose';

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', index: true, required: true },
    type: { type: String, enum: ['price', 'availability'], required: true },
  },
  { timestamps: true },
);

schema.index({ userId: 1, propertyId: 1, type: 1 }, { unique: true });

export const AlertSubscription = model('AlertSubscription', schema);
