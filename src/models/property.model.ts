import { Schema, model } from 'mongoose';

const propertySchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    description: { type: String, maxlength: 8000 },
    address: { type: String, required: true },
    region: { type: String, required: true, lowercase: true },
    city: { type: String, required: true },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    price: { type: Number, required: true, min: 0 },
    deposit: { type: Number, required: true, min: 0 },
    sizeM2: { type: Number, min: 1 },
    rooms: { type: Number, min: 0, default: 0 },
    bathrooms: { type: Number, min: 0, default: 0 },
    furnished: { type: Boolean, default: false },
    petsAllowed: { type: Boolean, default: false },
    availableFrom: { type: Date, required: true },
    availableTo: { type: Date },
    images: { type: [String], default: [] },
    status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft', index: true },
    favoritesCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    history: [
      {
        ts: { type: Date, default: Date.now },
        actorId: { type: Schema.Types.ObjectId, ref: 'User' },
        action: String,
        payload: Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true },
);

propertySchema.index({ location: '2dsphere' });
propertySchema.index({ city: 1, price: 1 });
propertySchema.index({ region: 1, status: 1 });

export const Property = model('Property', propertySchema);
