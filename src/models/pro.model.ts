import { Schema, model, Document } from 'mongoose';
export type ProService = 'plumbing'|'electricity'|'appliances'|'locksmith'|'cleaning'|'painting'|'others';
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
const s = new Schema<IPro>({
  userId: { type: String, index: true, unique: true },
  displayName: { type: String, required: true },
  city: { type: String, required: true },
  services: [{ key: String, basePrice: Number }],
  ratingAvg: { type: Number, default: 0 },
  jobsDone: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
},{timestamps:true});
export default model<IPro>('Pro', s);
