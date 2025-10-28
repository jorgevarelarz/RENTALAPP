import { Schema, model } from 'mongoose';

/**
 * Schema describing a coliving space. It's an extension of a property
 * with specific fields for shared living environments.
 */
const colivingSchema = new Schema(
  {
    title: { type: String, required: true },
    description: String,
    address: String,
    photos: [String],
    ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
    available: { type: Boolean, default: true },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
    
    // Coliving specific fields
    roomType: { type: String, enum: ['private', 'shared'], required: true },
    amenities: [String], // e.g., 'wifi', 'kitchen', 'gym', 'pool'
    monthlyRent: { type: Number, required: true },
    deposit: Number,
    houseRules: String,
  },
  { timestamps: true },
);

export const Coliving = model('Coliving', colivingSchema);
