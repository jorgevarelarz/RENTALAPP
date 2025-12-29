import mongoose, { Schema, Document } from 'mongoose';

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
export type PaymentType = 'rent' | 'deposit' | 'service' | 'settlement';

export interface IPayment extends Document {
  contract?: mongoose.Types.ObjectId;
  payer: mongoose.Types.ObjectId;
  payee?: mongoose.Types.ObjectId;

  amount: number;
  currency: string;
  status: PaymentStatus;
  type: PaymentType;
  concept: string;

  billingMonth?: number;
  billingYear?: number;
  dueDate?: Date;

  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  receiptUrl?: string;

  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema: Schema = new Schema(
  {
    contract: { type: Schema.Types.ObjectId, ref: 'Contract' },
    payer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    payee: { type: Schema.Types.ObjectId, ref: 'User' },

    amount: { type: Number, required: true },
    currency: { type: String, default: 'eur' },
    status: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    type: {
      type: String,
      enum: ['rent', 'deposit', 'service', 'settlement'],
      required: true,
      index: true,
    },
    concept: { type: String },

    billingMonth: { type: Number },
    billingYear: { type: Number },
    dueDate: { type: Date },

    stripePaymentIntentId: { type: String, unique: true, sparse: true },
    stripeChargeId: { type: String },
    receiptUrl: { type: String },

    paidAt: { type: Date },
  },
  { timestamps: true },
);

PaymentSchema.index(
  { contract: 1, type: 1, billingMonth: 1, billingYear: 1 },
  { unique: true, partialFilterExpression: { type: 'rent' } },
);

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
