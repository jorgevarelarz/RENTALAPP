import { Schema, model, Document, Types } from 'mongoose';

export interface IContractSignatureEvent extends Document {
  contractId: Types.ObjectId;
  userId?: Types.ObjectId;
  eventType: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  previousHash?: string;
  currentHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const contractSignatureEventSchema = new Schema<IContractSignatureEvent>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    eventType: { type: String, required: true },
    timestamp: { type: Date, required: true, index: true },
    ip: { type: String },
    userAgent: { type: String },
    previousHash: { type: String },
    currentHash: { type: String, required: true },
  },
  { timestamps: true },
);

contractSignatureEventSchema.index({ contractId: 1, timestamp: 1 });

export const ContractSignatureEvent = model<IContractSignatureEvent>(
  'ContractSignatureEvent',
  contractSignatureEventSchema,
);

