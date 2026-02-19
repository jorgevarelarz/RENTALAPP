import { Schema, model, Types } from 'mongoose';

export interface IPartnerEarning {
  kind: 'rent_fee_share';
  agencyId: Types.ObjectId;
  contractId: Types.ObjectId;
  propertyId: Types.ObjectId;
  stripeEventId: string;
  stripePaymentIntentId: string;
  platformFeeCents: number;
  sharePct: number;
  partnerShareCents: number;
  stripeTransferId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const partnerEarningSchema = new Schema<IPartnerEarning>(
  {
    kind: { type: String, enum: ['rent_fee_share'], required: true },
    agencyId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    stripeEventId: { type: String, required: true },
    stripePaymentIntentId: { type: String, required: true },
    platformFeeCents: { type: Number, required: true },
    sharePct: { type: Number, required: true },
    partnerShareCents: { type: Number, required: true },
    stripeTransferId: { type: String },
  },
  { timestamps: true },
);

partnerEarningSchema.index({ stripeEventId: 1, kind: 1 }, { unique: true });
partnerEarningSchema.index({ stripePaymentIntentId: 1, kind: 1 });

export const PartnerEarning = model<IPartnerEarning>('PartnerEarning', partnerEarningSchema);
