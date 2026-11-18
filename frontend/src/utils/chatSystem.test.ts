import { describe, expect, it } from 'vitest';
import { systemMessageLabel } from './chatSystem';

describe('systemMessageLabel', () => {
  it('traduce los avisos del servidor', () => {
    expect(systemMessageLabel('TICKET_OPENED')).toBe('Incidencia abierta');
    expect(systemMessageLabel('APPOINTMENT_ACCEPTED')).toBe('Cita aceptada');
  });

  it('no enseña códigos que no conoce', () => {
    expect(systemMessageLabel('ALGO_NUEVO')).toBe('Aviso automático');
    expect(systemMessageLabel(undefined)).toBe('Aviso automático');
  });
});
