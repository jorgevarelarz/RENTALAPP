import { Schema, model, Document, Types } from 'mongoose';

/**
 * Mongoose document type for rental contracts.
 */
export interface IContract extends Document {
  landlord: Types.ObjectId;
  tenant: Types.ObjectId;
  property: Types.ObjectId;
  rent: number;
  rentAmount?: number;
  currency?: string;
  deposit: number;
  startDate: Date;
  endDate: Date;
  signedByTenant?: boolean;
  signedAt?: Date;
  signedByLandlord?: boolean;
  ibanEncrypted?: string;
  stripeCustomerId?: string;
  paymentRef?: string;
  lastPaidAt?: Date;
  partiesSnapshot?: any;
  pdf?: { url?: string; sha256?: string; generatedAt?: Date };
  signFeeCollected?: boolean;
  signFeeCollectedAt?: Date;
  /**
   * The current status of the contract. Contracts begin in a 'draft' state
   * upon creation. Once both parties have signed, the status transitions
   * to 'active'. When the rental period ends or the landlord marks it as
   * finished, the status should be set to 'completed'. In the event of
   * early termination, the status can be set to 'cancelled'.
   */
  status: 'draft' | 'generated' | 'signing' | 'signed' | 'active' | 'completed' | 'cancelled';
  /**
   * Indicates whether the deposit (fianza) has been paid. Deposits can be
   * transferred either to a platform escrow account or to a public authority
   * depending on the chosen workflow. When the deposit is paid, the
   * timestamp is recorded in depositPaidAt.
   */
  depositPaid?: boolean;
  depositPaidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const contractSchema = new Schema<IContract>(
  {
    landlord: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tenant: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    rent: { type: Number, required: true },
    rentAmount: { type: Number },
    currency: { type: String, default: 'EUR' },
    deposit: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // Digital signature fields
    signedByTenant: { type: Boolean, default: false },
    signedByLandlord: { type: Boolean, default: false },
    signedAt: { type: Date },
    partiesSnapshot: { type: Schema.Types.Mixed },
    pdf: {
      url: { type: String },
      sha256: { type: String },
      generatedAt: { type: Date },
    },
    // Encrypted IBAN for automatic payments (if provided)
    ibanEncrypted: { type: String },
    // Optional Stripe customer ID for payment processing
    stripeCustomerId: { type: String },
    paymentRef: { type: String },
    lastPaidAt: { type: Date },
    // Current lifecycle status of the contract
    status: {
      type: String,
      enum: ['draft', 'generated', 'signing', 'signed', 'active', 'completed', 'cancelled'],
      default: 'draft',
    },
    // Deposit paid flag and timestamp
    depositPaid: { type: Boolean, default: false },
    depositPaidAt: { type: Date },
    signFeeCollected: { type: Boolean, default: false },
    signFeeCollectedAt: { type: Date },
  },
  { timestamps: true },
);

export const Contract = model<IContract>('Contract', contractSchema);