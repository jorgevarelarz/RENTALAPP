import { Schema, model, Document } from 'mongoose';

export interface IServiceOffer extends Document {
  conversationId: string;
  proId: string;
  ownerId: string;
  propertyId?: string;
  serviceKey: string;
  title: string;
  description?: string;
  amount: number;
  currency: 'EUR';
  status: 'proposed'| 'accepted' | 'rejected' | 'scheduled' | 'payment_pending' | 'paid' | 'confirmed' | 'done' | 'cancelled';
  ticketId?: string;
  appointmentId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ServiceOfferSchema = new Schema<IServiceOffer>({
  conversationId: { type: String, index: true, required: true },
  proId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true, index: true },
  propertyId: String,
  serviceKey: { type: String, required: true },
  title: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 1000 },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'EUR' },
  status: { type: String, default: 'proposed' },
  ticketId: String,
  appointmentId: String,
}, { timestamps: true });

ServiceOfferSchema.index({ conversationId: 1, createdAt: -1 });
ServiceOfferSchema.index({ proId: 1, ownerId: 1, status: 1 });

export default model<IServiceOffer>('ServiceOffer', ServiceOfferSchema);
