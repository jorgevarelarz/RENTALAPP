import { Schema, model } from 'mongoose';

/**
 * Verification status for a user. Each user can only have one verification
 * record which tracks the documents submitted and the review status.
 */
const verificationSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
    },
    method: { type: String, enum: ['dni', 'nie', 'passport'] },
    files: {
      idFrontUrl: String,
      idBackUrl: String,
      selfieUrl: String,
    },
    notes: { type: String },
  },
  { timestamps: true },
);

export const Verification = model('Verification', verificationSchema);
