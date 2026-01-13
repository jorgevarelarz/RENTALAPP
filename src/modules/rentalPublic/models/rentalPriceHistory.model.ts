import { Schema, model, Document, Types } from 'mongoose';

export interface IRentalPriceHistory extends Document {
  property: Types.ObjectId;
  contract?: Types.ObjectId;
  previousRent: number;
  newRent: number;
  changeDate: Date;
  reason: string;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

const rentalPriceHistorySchema = new Schema<IRentalPriceHistory>(
  {
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    contract: { type: Schema.Types.ObjectId, ref: 'Contract', index: true },
    previousRent: { type: Number, required: true },
    newRent: { type: Number, required: true },
    changeDate: { type: Date, required: true },
    reason: { type: String, required: true },
    source: { type: String },
  },
  { timestamps: true },
);

rentalPriceHistorySchema.index({ property: 1, changeDate: -1 });

export const RentalPriceHistory = model<IRentalPriceHistory>('RentalPriceHistory', rentalPriceHistorySchema);
