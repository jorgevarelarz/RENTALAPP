import { Schema, model, Document, Types } from 'mongoose';

// REFUNDED: el cobro se devolvió entero en Stripe (charge.refunded). No se vuelve a cobrar solo.
export type RentPaymentStatus = 'DUE' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface IRentPayment extends Document {
  contractId: Types.ObjectId;
  period: string; // YYYY-MM
  amount: number;
  status: RentPaymentStatus;
  paidByUserId?: Types.ObjectId;
  providerPaymentId?: string;
  paidAt?: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const rentPaymentSchema = new Schema<IRentPayment>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    period: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['DUE', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED'], default: 'DUE', index: true },
    paidByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    providerPaymentId: { type: String },
    paidAt: { type: Date },
    refundedAt: { type: Date },
  },
  { timestamps: true },
);

rentPaymentSchema.index({ contractId: 1, period: 1 }, { unique: true });

export const RentPayment = model<IRentPayment>('RentPayment', rentPaymentSchema);
