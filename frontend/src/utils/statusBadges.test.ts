import { describe, it, expect } from 'vitest';
import { getStatusLabel, getStatusTone } from './statusBadges';

describe('getStatusLabel', () => {
  it('traduce los estados de incidencias y pagos en vez de mostrar el valor interno', () => {
    expect(getStatusLabel('in_progress')).toBe('En curso');
    expect(getStatusLabel('awaiting_schedule')).toBe('Por agendar');
    expect(getStatusLabel('succeeded')).toBe('Pagado');
    expect(getStatusLabel('disputed')).toBe('En disputa');
  });

  it('usa las etiquetas de contrato y la etiqueta explícita', () => {
    expect(getStatusLabel('pending_signature')).toBe('Pendiente de firma');
    expect(getStatusLabel('active')).toBe('Activo');
    expect(getStatusLabel('succeeded', 'Pagado el 1/10')).toBe('Pagado el 1/10');
  });

  it('un estado desconocido sale legible y con mayúscula inicial', () => {
    expect(getStatusLabel('on_hold')).toBe('On hold');
    expect(getStatusLabel()).toBe('Estado');
  });

  it('las disputas y validaciones tienen tono', () => {
    expect(getStatusTone('disputed')).toBe('danger');
    expect(getStatusTone('awaiting_validation')).toBe('warning');
  });
});
