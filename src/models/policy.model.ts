import mongoose, { Schema, Document } from 'mongoose';

export type PolicyType =
  | 'privacy_policy'
  | 'terms_of_service'
  | 'cookies_policy'
  | 'data_processing';

export interface IPolicyVersion extends Document {
  policyType: PolicyType;
  version: string;
  isActive: boolean;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PolicyVersionSchema = new Schema<IPolicyVersion>(
  {
    policyType: {
      type: String,
      required: true,
      enum: ['privacy_policy', 'terms_of_service', 'cookies_policy', 'data_processing'],
      index: true,
    },
    version: {
      type: String,
      required: true,
      match: /^v\d+\.\d+$/,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

PolicyVersionSchema.index({ policyType: 1, version: 1 }, { unique: true });

export const PolicyVersion = mongoose.model<IPolicyVersion>(
  'PolicyVersion',
  PolicyVersionSchema
);
