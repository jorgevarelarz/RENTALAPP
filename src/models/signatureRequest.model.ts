import { Schema, model, Types, Document } from 'mongoose';

export interface ISignatureRequest extends Document {
  contractId: Types.ObjectId;
  provider: string;
  requestId: string;
  status: string;
  signerLinks?: Record<string, string>;
  evidence?: any;
  finalPdfUrl?: string;
  finalPdfSha256?: string;
  createdAt: Date;
  updatedAt: Date;
}

const signatureRequestSchema = new Schema<ISignatureRequest>({
  contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
  provider: { type: String, required: true },
  requestId: { type: String, required: true },
  status: { type: String, required: true },
  signerLinks: { type: Schema.Types.Mixed },
  evidence: { type: Schema.Types.Mixed },
  finalPdfUrl: { type: String },
  finalPdfSha256: { type: String },
}, { timestamps: true });

export const SignatureRequest = model<ISignatureRequest>('SignatureRequest', signatureRequestSchema);
