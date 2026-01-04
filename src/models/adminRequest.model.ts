import { Schema, model, Document, Types } from 'mongoose';

export type AdminRequestType = 'REMOVE_COTENANT';
export type AdminRequestStatus = 'OPEN' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface IAdminRequest extends Document {
  type: AdminRequestType;
  contractId: Types.ObjectId;
  requestedByUserId: Types.ObjectId;
  targetPartyId: Types.ObjectId;
  reason?: string;
  status: AdminRequestStatus;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminRequestSchema = new Schema<IAdminRequest>(
  {
    type: { type: String, enum: ['REMOVE_COTENANT'], required: true, index: true },
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    requestedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetPartyId: { type: Schema.Types.ObjectId, ref: 'ContractParty', required: true },
    reason: { type: String },
    status: { type: String, enum: ['OPEN', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED'], default: 'OPEN', index: true },
    adminNotes: { type: String },
  },
  { timestamps: true },
);

adminRequestSchema.index({ contractId: 1, targetPartyId: 1, status: 1 });

export const AdminRequest = model<IAdminRequest>('AdminRequest', adminRequestSchema);
