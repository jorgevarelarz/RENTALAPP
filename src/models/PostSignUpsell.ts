import { Schema, model, Types } from 'mongoose';

export type UpsellStatus = 'pending' | 'remind_later' | 'dismissed' | 'completed';

const PostSignUpsellSchema = new Schema(
  {
    userId: { type: Types.ObjectId, required: true, index: true },
    contractId: { type: Types.ObjectId, required: true, index: true },
    address: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'remind_later', 'dismissed', 'completed'],
      default: 'pending',
    },
    remindAt: { type: Date },
  },
  { timestamps: true, collection: 'postsign_upsell' },
);

PostSignUpsellSchema.index({ userId: 1, contractId: 1 }, { unique: true });

export const PostSignUpsell = model('PostSignUpsell', PostSignUpsellSchema);

