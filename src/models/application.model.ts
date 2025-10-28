import { Schema, model, Document } from 'mongoose';

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'visited';

export interface IApplicationHistoryItem {
  ts: Date;
  actorId?: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface IApplication extends Document {
  propertyId: string;
  tenantId: string;
  status: ApplicationStatus;
  visitDate?: Date;
  history: IApplicationHistoryItem[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IApplication>(
  {
    propertyId: { type: String, required: true },
    tenantId: { type: String, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'visited'], default: 'pending' },
    visitDate: { type: Date },
  },
  { timestamps: true },
);

schema.add({
  history: {
    type: [
      {
        ts: { type: Date, default: Date.now },
        actorId: { type: String },
        action: { type: String, required: true },
        payload: { type: Schema.Types.Mixed },
      },
    ],
    default: [],
  },
});

schema.index({ propertyId: 1, tenantId: 1 }, { unique: true });

export const Application = model<IApplication>('Application', schema);
