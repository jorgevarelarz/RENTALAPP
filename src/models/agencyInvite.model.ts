import { Schema, model, Types } from 'mongoose';

export interface IAgencyInvite {
  agencyId: Types.ObjectId;
  landlordName: string;
  landlordEmail: string;
  landlordPhone?: string;
  propertyAddress?: string;
  propertyCity?: string;
  token: string;
  status: 'invited' | 'accepted' | 'expired';
  landlordId?: Types.ObjectId;
  acceptedAt?: Date;
  expiresAt: Date;
  /** Resultado y fecha del último envío del email con el enlace. */
  emailStatus?: 'sent' | 'not_configured' | 'failed';
  emailSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const agencyInviteSchema = new Schema<IAgencyInvite>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    landlordName: { type: String, required: true, trim: true },
    landlordEmail: { type: String, required: true, lowercase: true, trim: true },
    landlordPhone: { type: String, trim: true },
    propertyAddress: { type: String, trim: true },
    propertyCity: { type: String, trim: true },
    // SHA-256 del token del enlace (las invitaciones antiguas lo guardaban en claro).
    token: { type: String, required: true, unique: true, index: true, select: false },
    status: { type: String, enum: ['invited', 'accepted', 'expired'], default: 'invited' },
    landlordId: { type: Schema.Types.ObjectId, ref: 'User' },
    acceptedAt: { type: Date },
    expiresAt: { type: Date, required: true },
    emailStatus: { type: String, enum: ['sent', 'not_configured', 'failed'] },
    emailSentAt: { type: Date },
  },
  { timestamps: true },
);

agencyInviteSchema.index({ agencyId: 1, createdAt: -1 });
agencyInviteSchema.index({ landlordEmail: 1, status: 1 });

export const AgencyInvite = model<IAgencyInvite>('AgencyInvite', agencyInviteSchema);
