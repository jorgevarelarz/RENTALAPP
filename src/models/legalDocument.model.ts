import { Schema, model } from 'mongoose';

export type LegalSlug = 'terms' | 'privacy' | 'tenant-pro-consent';

const legalDocumentSchema = new Schema(
  {
    slug: {
      type: String,
      enum: ['terms', 'privacy', 'tenant-pro-consent'],
      required: true,
    },
    version: { type: String, required: true },
    content: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

legalDocumentSchema.index({ slug: 1, version: -1 }, { unique: true });

export const LegalDocument = model('LegalDocument', legalDocumentSchema);
