// src/models/userPolicyAcceptance.model.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPolicyAcceptance extends Document {
  userId: mongoose.Types.ObjectId;
  policyType: 'privacy_policy' | 'terms_of_service' | 'cookies_policy';
  policyVersion: string;
  acceptedAt: Date;
}

const UserPolicyAcceptanceSchema = new Schema<IUserPolicyAcceptance>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    policyType: {
      type: String,
      required: true,
      enum: ['privacy_policy', 'terms_of_service', 'cookies_policy'],
    },
    policyVersion: {
      type: String,
      required: true,
      match: /^v\d+\.\d+$/, // e.g. v1.0
    },
    acceptedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Evita duplicados: un usuario no puede aceptar dos veces la misma versión
UserPolicyAcceptanceSchema.index(
  { userId: 1, policyType: 1, policyVersion: 1 },
  { unique: true }
);

export const UserPolicyAcceptance = mongoose.model<IUserPolicyAcceptance>(
  'UserPolicyAcceptance',
  UserPolicyAcceptanceSchema
);
