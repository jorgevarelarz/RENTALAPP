export interface FeatureFlags {
  payments: boolean;
  eSign: boolean;
  sepa: boolean;
  kyc: boolean;
  utilities: boolean;
  insurance: boolean;
}

export const initialFlags: FeatureFlags = {
  payments: true,
  eSign: true,
  sepa: true,
  kyc: true,
  utilities: false,
  insurance: false,
};
