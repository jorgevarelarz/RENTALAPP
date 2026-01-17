import { Schema, model } from 'mongoose';

export type TenantProDocType = 'nomina' | 'contrato' | 'renta' | 'autonomo' | 'otros';

const tenantProDocSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['nomina', 'contrato', 'renta', 'autonomo', 'otros'],
      required: true,
    },
    url: {
      type: String,
      required(this: { archivedAt?: Date }) {
        return !this.archivedAt;
      },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    uploadedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewer: { type: Schema.Types.ObjectId, ref: 'User' },
    hash: { type: String },
    archivedAt: { type: Date },
  },
  { _id: true },
);

const tenantProDocAuditSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['nomina', 'contrato', 'renta', 'autonomo', 'otros'],
      required: true,
    },
    hash: { type: String },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
    },
    reviewedAt: { type: Date },
    archivedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const tenantProSchema = new Schema(
  {
    isActive: { type: Boolean, default: false },
    maxRent: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['none', 'pending', 'verified', 'rejected'],
      default: 'none',
    },
    docs: { type: [tenantProDocSchema], default: [] },
    auditTrail: { type: [tenantProDocAuditSchema], default: [] },
    consentAccepted: { type: Boolean, default: false },
    consentTextVersion: { type: String },
    consentAcceptedAt: { type: Date },
    lastDecisionAt: { type: Date },
  },
  { _id: false },
);

/**
 * Schema for users. The role distinguishes between landlords and tenants.
 * Passwords are stored hashed in the passwordHash field.
 */
const institutionScopeSchema = new Schema(
  {
    areaKeys: { type: [String], default: [] },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    // Passwords are stored hashed; see controllers/auth.controller.ts
    passwordHash: { type: String, required: true, select: false },
    /**
     * Role assigned to the user. Supported values include:
     *  - tenant: standard renter of properties.
     *  - landlord: owner of one or more properties.
     *  - admin: platform administrator with elevated privileges.
     *  - institution_viewer: government/public-sector read-only access.
     *
     * Additional roles can be added here as the system evolves, e.g. for
     * community‐level managers when offering a SaaS model to governments.
     */
    role: {
      type: String,
      enum: ['landlord', 'tenant', 'admin', 'pro', 'institution_viewer'],
      required: true,
    },
    ratingAvg: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    phone: { type: String },
    avatar: { type: String },
    bio: { type: String, maxlength: 1000 },
    jobTitle: { type: String },
    monthlyIncome: { type: Number },
    companyName: { type: String },
    serviceCategory: {
      type: String,
      enum: [
        'general',
        'fontaneria',
        'electricidad',
        'carpinteria',
        'albanileria',
        'pintura',
        'limpieza',
        'jardineria',
        'inmobiliaria',
        'cerrajeria',
        'otros',
      ],
      default: 'general',
    },
    // Optional Stripe identifiers for payments
    stripeAccountId: { type: String },
    stripeCustomerId: { type: String },
    // Password reset support
    resetToken: { type: String },
    resetTokenExp: { type: Date },
    institutionScope: { type: institutionScopeSchema, default: undefined },
  },
  { timestamps: true },
);

userSchema.add({ tenantPro: { type: tenantProSchema, default: () => ({}) } });

userSchema.index({ 'tenantPro.status': 1, 'tenantPro.maxRent': -1 });

export const User = model('User', userSchema);
