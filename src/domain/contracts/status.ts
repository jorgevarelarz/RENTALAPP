export const CANONICAL_CONTRACT_STATUSES = [
  'draft',
  'pending_signature',
  'signed',
  'active',
  'terminated',
] as const;

export const LEGACY_CONTRACT_STATUSES = [
  'generated',
  'signing',
  'completed',
  'cancelled',
] as const;

export const ALL_CONTRACT_STATUSES = [
  ...CANONICAL_CONTRACT_STATUSES,
  ...LEGACY_CONTRACT_STATUSES,
] as const;

export type ContractStatus = (typeof CANONICAL_CONTRACT_STATUSES)[number];
export type LegacyContractStatus = (typeof LEGACY_CONTRACT_STATUSES)[number];
export type PersistedContractStatus = (typeof ALL_CONTRACT_STATUSES)[number];

const LEGACY_STATUS_TO_CANONICAL: Record<LegacyContractStatus, ContractStatus> = {
  generated: 'draft',
  signing: 'pending_signature',
  completed: 'terminated',
  cancelled: 'terminated',
};

const TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ['pending_signature', 'terminated'],
  pending_signature: ['signed', 'terminated'],
  signed: ['active', 'terminated'],
  active: ['terminated'],
  terminated: [],
};

export function normalizeContractStatus(
  status: PersistedContractStatus | string | undefined | null,
): ContractStatus {
  if (!status) return 'draft';
  if ((CANONICAL_CONTRACT_STATUSES as readonly string[]).includes(status)) {
    return status as ContractStatus;
  }
  if ((LEGACY_CONTRACT_STATUSES as readonly string[]).includes(status)) {
    return LEGACY_STATUS_TO_CANONICAL[status as LegacyContractStatus];
  }
  return 'draft';
}

export function canTransitionContract(from: PersistedContractStatus | string | undefined | null, to: ContractStatus) {
  if (from && !(ALL_CONTRACT_STATUSES as readonly string[]).includes(from)) return false;
  const normalizedFrom = normalizeContractStatus(from);
  return TRANSITIONS[normalizedFrom]?.includes(to) ?? false;
}

export function getNextSigningStatus(params: {
  signedByTenant?: boolean;
  signedByLandlord?: boolean;
}): ContractStatus {
  return params.signedByTenant && params.signedByLandlord ? 'signed' : 'pending_signature';
}
