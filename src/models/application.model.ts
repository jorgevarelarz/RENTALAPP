import { Schema, model, Types } from 'mongoose';

export interface IApplication {
  propertyId: Types.ObjectId;
  tenantId: Types.ObjectId;
  status: 'pending' | 'proposed' | 'scheduled' | 'rejected';
  proposedDate?: Date;
  proposedBy?: 'tenant' | 'landlord';
  visitDate?: Date;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    propertyId: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: ['pending', 'proposed', 'scheduled', 'rejected'], default: 'pending' },
    proposedDate: { type: Date },
    proposedBy: { type: String, enum: ['tenant', 'landlord'] },
    visitDate: { type: Date },
    message: { type: String },
  },
  { timestamps: true },
);

applicationSchema.index({ propertyId: 1, tenantId: 1 }, { unique: true });

export const Application = model<IApplication>('Application', applicationSchema);
