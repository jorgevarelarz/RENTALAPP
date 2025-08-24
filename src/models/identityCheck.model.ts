import { Schema, model, Document } from 'mongoose';

export interface IIdentityCheck extends Document {
  userId: string;
  provider: string;
  sessionId: string;
  status: string;
  result?: any;
  createdAt: Date;
  updatedAt: Date;
}

const identityCheckSchema = new Schema<IIdentityCheck>({
  userId: { type: String, required: true },
  provider: { type: String, required: true },
  sessionId: { type: String, required: true },
  status: { type: String, required: true },
  result: { type: Schema.Types.Mixed },
}, { timestamps: true });

export const IdentityCheck = model<IIdentityCheck>('IdentityCheck', identityCheckSchema);
