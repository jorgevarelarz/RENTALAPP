import { Schema, model, Document } from 'mongoose';

export interface IEscrow extends Document {
  contractId: string;
  ticketId: string;
  amount: number;
  currency: 'EUR';
  status: 'held' | 'released' | 'disputed';
  breakdown?: { gross: number; fee: number; netToPro: number };
  ledger: { ts: Date; type: 'hold' | 'release' | 'refund'; payload?: any }[];
  provider: 'stripe' | 'mock';
  paymentRef?: string; // Stripe PaymentIntent id o mock ref
}

const s = new Schema<IEscrow>(
  {
    contractId: { type: String, required: true },
    ticketId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'EUR' },
    status: { type: String, default: 'held' },
    breakdown: { gross: Number, fee: Number, netToPro: Number },
    ledger: [{ ts: Date, type: String, payload: Schema.Types.Mixed }],
    provider: { type: String, default: 'mock' },
    paymentRef: String,
  },
  { timestamps: true }
);

// Índice para búsquedas rápidas por ticket
s.index({ ticketId: 1 });

export default model<IEscrow>('Escrow', s);