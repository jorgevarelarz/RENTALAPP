import { Schema, model, Document, Types } from 'mongoose';

export type ContractPartyRole = 'TENANT';
export type ContractPartyStatus =
  | 'INVITED'
  | 'JOINED'
  | 'SIGNED'
  | 'REJECTED'
  | 'REMOVED_PENDING_ADMIN'
  | 'REMOVED';

export interface IContractParty extends Document {
  contractId: Types.ObjectId;
  role: ContractPartyRole;
  userId?: Types.ObjectId;
  email: string;
  status: ContractPartyStatus;
  invitedByUserId?: Types.ObjectId;
  inviteTokenHash?: string;
  inviteExpiresAt?: Date;
  signedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const contractPartySchema = new Schema<IContractParty>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true, index: true },
    role: { type: String, enum: ['TENANT'], default: 'TENANT', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    status: {
      type: String,
      enum: ['INVITED', 'JOINED', 'SIGNED', 'REJECTED', 'REMOVED_PENDING_ADMIN', 'REMOVED'],
      default: 'INVITED',
      index: true,
    },
    invitedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    inviteTokenHash: { type: String },
    inviteExpiresAt: { type: Date },
    signedAt: { type: Date },
  },
  { timestamps: true },
);

contractPartySchema.index(
  { contractId: 1, email: 1, role: 1 },
  { unique: true, partialFilterExpression: { email: { $exists: true } } },
);

export const ContractParty = model<IContractParty>('ContractParty', contractPartySchema);
