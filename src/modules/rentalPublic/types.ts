export enum ComplianceStatusValue {
  Compliant = 'compliant',
  Risk = 'risk',
  NonCompliant = 'non_compliant',
}

export enum ComplianceSeverity {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
}

export enum ComplianceReasonCode {
  RentIncreaseTensionedArea = 'RENT_INCREASE_TENSIONED_AREA',
}

export const RULE_VERSION = 'es-housing:v1' as const;

export type RuleInputs = {
  previousRent: number;
  newRent: number;
  changeDate: Date;
};
