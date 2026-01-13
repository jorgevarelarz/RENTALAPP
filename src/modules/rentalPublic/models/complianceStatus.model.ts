import { Schema, model, Document, Types } from 'mongoose';
import { ComplianceReasonCode, ComplianceStatusValue, RULE_VERSION, RuleInputs } from '../types';

export interface IComplianceStatus extends Document {
  contract: Types.ObjectId;
  property: Types.ObjectId;
  status: ComplianceStatusValue;
  checkedAt: Date;
  previousRent: number;
  newRent: number;
  isTensionedArea: boolean;
  ruleVersion: string;
  reasons: ComplianceReasonCode[];
  meta?: {
    tensionedAreaId?: Types.ObjectId;
    areaKey?: string;
    ruleInputs?: RuleInputs;
  };
  createdAt: Date;
  updatedAt: Date;
}

const complianceStatusSchema = new Schema<IComplianceStatus>(
  {
    contract: { type: Schema.Types.ObjectId, ref: 'Contract', required: true, unique: true, index: true },
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true, index: true },
    status: { type: String, enum: Object.values(ComplianceStatusValue), required: true },
    checkedAt: { type: Date, required: true },
    previousRent: { type: Number, required: true },
    newRent: { type: Number, required: true },
    isTensionedArea: { type: Boolean, default: false },
    ruleVersion: { type: String, default: RULE_VERSION },
    reasons: { type: [String], default: [] },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

complianceStatusSchema.index({ property: 1, checkedAt: -1 });

export const ComplianceStatus = model<IComplianceStatus>('ComplianceStatus', complianceStatusSchema);
