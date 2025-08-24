import { Schema, model } from 'mongoose';

/**
 * Schema for users. The role distinguishes between landlords and tenants.
 * Passwords are stored hashed in the passwordHash field.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    // Passwords are stored hashed; see controllers/auth.controller.ts
    passwordHash: { type: String, required: true },
    /**
     * Role assigned to the user. Supported values include:
     *  - tenant: standard renter of properties.
     *  - landlord: owner of one or more properties.
     *  - admin: platform administrator with elevated privileges.
     *
     * Additional roles can be added here as the system evolves, e.g. for
     * community‐level managers when offering a SaaS model to governments.
     */
    role: {
      type: String,
      enum: ['landlord', 'tenant', 'admin'],
      required: true,
    },
    ratingAvg: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    // Optional Stripe identifiers for payments
    stripeAccountId: { type: String },
    stripeCustomerId: { type: String },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);
