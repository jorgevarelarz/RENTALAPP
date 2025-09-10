import { Schema, model } from 'mongoose';

/**
 * Schema describing a real estate property. The ownerId references a
 * user document. An array of photo URLs can be provided.
 */
const propertySchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    price: Number,
    address: String,
    photos: [String],
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
    available: { type: Boolean, default: true },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
  },
  { timestamps: true },
);

export const Property = model('Property', propertySchema);