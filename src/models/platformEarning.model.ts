import { Schema, model, Document } from 'mongoose';

interface IPlatformEarning extends Document {
  kind: 'rent' | 'service';
  ticketId?: string;
  escrowId?: string;
  offerId?: string;
  proId?: string;
  serviceKey?: string;
  gross: number;
  fee: number;
  netToPro: number;
  currency: string;
  releaseRef?: string;
  paymentRef?: string;
  city?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const PlatformEarningSchema = new Schema<IPlatformEarning>({
  kind: { type: String, enum: ['rent', 'service'], required: true },
  ticketId: { type: String, index: true },
  escrowId: String,
  offerId: { type: String, index: true },
  proId: { type: String, index: true },
  serviceKey: String,
  gross: Number,
  fee: Number,
  netToPro: Number,
  currency: { type: String, default: 'EUR' },
  releaseRef: String,
  paymentRef: String,
  city: String,
}, { timestamps: true });

// Una ganancia por escrow: la liberación del ticket puede reintentarse sin duplicarla.
// Nombre propio porque en las BD existentes ya hay un `escrowId_1` no único con el nombre automático.
PlatformEarningSchema.index(
  { escrowId: 1 },
  { name: 'escrowId_unique', unique: true, partialFilterExpression: { escrowId: { $type: 'string' } } },
);

export default model<IPlatformEarning>('PlatformEarning', PlatformEarningSchema);

