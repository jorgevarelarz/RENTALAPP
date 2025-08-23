import { Schema, model, Document } from 'mongoose';

interface IPlatformEarning extends Document {
  ticketId: string;
  escrowId: string;
  gross: number;
  fee: number;
  netToPro: number;
  currency: string;
  releaseRef: string;
  proId?: string;
  serviceKey?: string;
  city?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const PlatformEarningSchema = new Schema<IPlatformEarning>({
  ticketId: { type: String, index: true },
  escrowId: { type: String, index: true },
  gross: Number,
  fee: Number,
  netToPro: Number,
  currency: { type: String, default: 'EUR' },
  releaseRef: String,
  proId: { type: String, index: true },
  serviceKey: String,
  city: String,
}, { timestamps: true });

export default model<IPlatformEarning>('PlatformEarning', PlatformEarningSchema);

