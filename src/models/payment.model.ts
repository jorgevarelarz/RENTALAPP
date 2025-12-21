import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  contract: mongoose.Types.ObjectId;
  payer: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  stripePaymentIntentId: string;
  status: 'pending' | 'succeeded' | 'failed';
  concept: string;
  paidAt?: Date;
  receiptUrl?: string;
}

const PaymentSchema: Schema = new Schema(
  {
    contract: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
    payer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'eur' },
    stripePaymentIntentId: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'succeeded', 'failed'], default: 'pending' },
    concept: { type: String, required: true },
    paidAt: { type: Date },
    receiptUrl: { type: String },
  },
  { timestamps: true },
);

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
