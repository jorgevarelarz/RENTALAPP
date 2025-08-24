import { Schema, model, Document } from 'mongoose';

export interface IReview extends Document {
  fromUserId: string;
  toUserId: string;
  roleContext: 'tenant' | 'owner' | 'pro';
  relatedId: string;
  score: number;
  comment?: string;
  createdAt: Date;
}

const s = new Schema<IReview>({
  fromUserId: { type: String, required: true },
  toUserId: { type: String, required: true },
  roleContext: { type: String, required: true, enum: ['tenant', 'owner', 'pro'] },
  relatedId: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 5 },
  comment: { type: String, maxlength: 1000 },
  createdAt: { type: Date, default: () => new Date() }
});

s.index({ toUserId: 1, createdAt: -1 });
s.index({ fromUserId: 1, toUserId: 1, relatedId: 1 }, { unique: true });

export default model<IReview>('Review', s);
