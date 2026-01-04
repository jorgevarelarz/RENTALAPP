import { Schema, model, Document, Types } from 'mongoose';

export type RentPaymentStatus = 'DUE' | 'PROCESSING' | 'PAID' | 'FAILED';

export interface IRentPayment extends Document {
  contractId: Types.ObjectId;
  period: string; // YYYY-MM
  amount: number;
  status: RentPaymentStatus;
  paidByUserId?: Types.ObjectId;
  providerPaymentId?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const rentPaymentSchema = new Schema<IRentPayment>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    period: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['DUE', 'PROCESSING', 'PAID', 'FAILED'], default: 'DUE', index: true },
    paidByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    providerPaymentId: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

rentPaymentSchema.index({ contractId: 1, period: 1 }, { unique: true });

export const RentPayment = model<IRentPayment>('RentPayment', rentPaymentSchema);
