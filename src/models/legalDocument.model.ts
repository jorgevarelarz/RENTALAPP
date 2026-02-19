import { Schema, model, Document } from 'mongoose';

export type LegalSource = 'LAU';

export interface ILegalDocument extends Document {
  source: LegalSource;
  versionDate?: string;
  fetchedAt: Date;
  url: string;
  content: string;
  hash: string;
  meta?: Record<string, unknown>;
}

const legalDocumentSchema = new Schema<ILegalDocument>(
  {
    source: { type: String, enum: ['LAU'], required: true, index: true },
    versionDate: { type: String },
    fetchedAt: { type: Date, default: Date.now, index: true },
    url: { type: String, required: true },
    content: { type: String, required: true },
    hash: { type: String, required: true, index: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

legalDocumentSchema.index({ source: 1, versionDate: -1 });

export const LegalDocument = model<ILegalDocument>('LegalDocument', legalDocumentSchema);
