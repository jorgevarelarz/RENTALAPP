import { Schema, model, Document } from 'mongoose';

export type ProService =
  | 'plumbing'
  | 'electricity'
  | 'appliances'
  | 'locksmith'
  | 'cleaning'
  | 'painting'
  | 'others';
export interface IPro extends Document {
  userId: string;
  displayName: string;
  city: string;
  services: { key: ProService; basePrice?: number }[];
  ratingAvg: number;
  jobsDone: number;
  verified: boolean;
  active: boolean;
}

const serviceSchema = new Schema<{ key: ProService; basePrice?: number }>({
  key: { type: String, enum: ['plumbing', 'electricity', 'appliances', 'locksmith', 'cleaning', 'painting', 'others'], required: true },
  basePrice: Number,
}, { _id: false });

const s = new Schema<IPro>({
  userId: { type: String, required: true, unique: true, index: true },
  displayName: { type: String, required: true },
  city: { type: String, required: true, index: true },
  services: [serviceSchema],
  ratingAvg: { type: Number, default: 0 },
  jobsDone: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
},{timestamps:true});
s.index({ 'services.key': 1 });
export default model<IPro>('Pro', s);
