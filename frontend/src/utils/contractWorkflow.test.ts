import { describe, expect, it } from 'vitest';
import { getContractActionSummary, getContractStatusLabel } from './contractWorkflow';
import { getStatusLabel, getStatusTone } from './statusBadges';

describe('recovered contract workflow', () => {
  it('shows legacy status guidance and handles invalid dates', () => {
    const contract = { status: 'signing' as const, rent: 800, deposit: 800 };
    expect(getContractActionSummary(contract, 'landlord').label).toBe('Firmas pendientes');
    expect(getContractStatusLabel('generated')).toBe('Borrador');
    expect(getStatusTone('signing')).toBe('warning');
    expect(getStatusLabel('signed')).toBe('Firmado');
    expect(getStatusLabel('signed', 'Custom')).toBe('Custom');
    expect(getContractActionSummary({ ...contract, status: 'cancelled' }).tone).toBe('neutral');
    expect(getContractActionSummary({ ...contract, status: 'active', endDate: 'invalid' }).nextDate).toBeNull();
    expect(getContractActionSummary({ ...contract, status: 'signed', depositPaid: true }).blockedReason).toBeNull();
  });

});
