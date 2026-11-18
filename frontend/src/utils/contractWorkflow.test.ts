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

  it('dice a cada parte qué le toca, sin jerga', () => {
    const contract = { status: 'signed' as const, rent: 800, deposit: 800, startDate: '2026-11-01T00:00:00.000Z' };
    expect(getContractActionSummary(contract, 'tenant').nextAction).toBe('Paga la fianza');
    expect(getContractActionSummary(contract, 'landlord').nextAction).toBe('Esperar a que el inquilino pague la fianza');
    const paid = getContractActionSummary({ ...contract, depositPaid: true }, 'tenant');
    expect(paid.detail).toMatch(/se activa solo el 1\/11\/2026/i);
    const draft = getContractActionSummary({ ...contract, status: 'draft' }, 'tenant');
    expect(draft.blockedReason).toBeNull();
    expect(draft.nextAction).toBe('El propietario lo enviará a firmar cuando esté listo');
    expect(getContractActionSummary({ ...contract, status: 'pending_signature' }, 'tenant').nextAction).toBe('Revisa y firma el contrato');
  });
});
