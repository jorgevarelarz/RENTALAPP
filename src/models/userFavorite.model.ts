import { Schema, model } from 'mongoose';

const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, required: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', index: true, required: true },
  },
  { timestamps: true },
);

schema.index({ userId: 1, propertyId: 1 }, { unique: true });

export const UserFavorite = model('UserFavorite', schema);
