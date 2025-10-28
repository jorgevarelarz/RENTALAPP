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
  region: string;
  clausePolicyVersion?: string;
  clauses: Record<string, any> | {
    id: string;
    label?: string;
    version: string;
    params: Record<string, unknown>;
    text?: string;
    scope?: 'base' | 'regional';
  }[];
  pdfPath?: string;
  pdfHash?: string;
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
  signature?: {
    provider?: 'mock' | 'docusign';
    envelopeId?: string;
    status?: 'none' | 'created' | 'sent' | 'completed' | 'declined' | 'error';
    updatedAt?: Date;
    events?: { at: Date; type: string; meta?: Record<string, unknown> }[];
    providerEventId?: string;
    pdfUrl?: string;
    pdfHash?: string;
  };
  /**
   * The current status of the contract. Contracts begin in a 'draft' state
   * upon creation. Once both parties have signed, the status transitions
   * to 'active'. When the rental period ends or the landlord marks it as
   * finished, the status should be set to 'completed'. In the event of
   * early termination, the status can be set to 'terminated'. Legacy
   * workflows may still use 'cancelled' for similar scenarios.
   */
  status:
    | 'draft'
    | 'generated'
    | 'signing'
    | 'signed'
    | 'active'
    | 'completed'
    | 'cancelled'
    | 'pending_signature'
    | 'terminated';
  /**
   * Indicates whether the deposit (fianza) has been paid. Deposits can be
   * transferred either to a platform escrow account or to a public authority
   * depending on the chosen workflow. When the deposit is paid, the
   * timestamp is recorded in depositPaidAt.
   */
  depositPaid?: boolean;
  depositPaidAt?: Date;
  history?: {
    ts: Date;
    actorId?: string;
    action: string;
    payload: Record<string, unknown>;
  }[];
  metadata?: Record<string, unknown>;
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
    region: { type: String, required: true, default: 'general' },
    clausePolicyVersion: { type: String },
    clauses: { type: Schema.Types.Mixed, default: {} },
    pdfPath: { type: String },
    pdfHash: { type: String },
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
    signature: {
      provider: { type: String, enum: ['mock', 'docusign'] },
      envelopeId: { type: String },
      status: { type: String, enum: ['none', 'created', 'sent', 'completed', 'declined', 'error'], default: 'none' },
      updatedAt: { type: Date },
      events: {
        type: [
          {
            at: { type: Date, default: Date.now },
            type: { type: String, required: true },
            meta: { type: Schema.Types.Mixed },
          },
        ],
        default: [],
      },
      providerEventId: { type: String },
      pdfUrl: { type: String },
      pdfHash: { type: String },
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
      enum: [
        'draft',
        'generated',
        'signing',
        'signed',
        'active',
        'completed',
        'cancelled',
        'pending_signature',
        'terminated',
      ],
      default: 'draft',
    },
    // Deposit paid flag and timestamp
    depositPaid: { type: Boolean, default: false },
    depositPaidAt: { type: Date },
    signFeeCollected: { type: Boolean, default: false },
    signFeeCollectedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
    history: {
      type: [
        {
          ts: { type: Date, default: Date.now },
          actorId: { type: String },
          action: { type: String, required: true },
          payload: { type: Schema.Types.Mixed, default: {} },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export const Contract = model<IContract>('Contract', contractSchema);
