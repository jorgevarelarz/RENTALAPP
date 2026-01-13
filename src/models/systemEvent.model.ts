import { Schema, model, Document } from 'mongoose';

export interface ISystemEvent extends Document {
  type: string;
  resourceType?: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const systemEventSchema = new Schema<ISystemEvent>(
  {
    type: { type: String, required: true, index: true },
    resourceType: { type: String },
    resourceId: { type: String, index: true },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

systemEventSchema.index({ type: 1, resourceType: 1, resourceId: 1 }, { unique: true, sparse: true });

export const SystemEvent = model<ISystemEvent>('SystemEvent', systemEventSchema);
