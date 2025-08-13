import { Schema, model, Types } from 'mongoose';

/**
 * Tracks changes to a contract over time. Each entry records what happened
 * and when, along with a short description. This is useful for audit
 * purposes and for displaying a timeline to users.
 */
const historySchema = new Schema(
  {
    contract: { type: Types.ObjectId, ref: 'Contract', required: true },
    action: { type: String, required: true },
    description: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const ContractHistory = model('ContractHistory', historySchema);