import { describe, expect, it } from 'vitest';
import { applicationText, availabilityText, depositText, propertyFacts, propertyFeatures } from './propertyDetail';
import type { Property } from '../types/property';

describe('propertyDetail', () => {
  it('resume habitaciones, baños y metros con plurales y el estudio', () => {
    expect(propertyFacts({ rooms: 1, bathrooms: 2, sizeM2: 1250 })).toEqual(['1 habitación', '2 baños', '1250 m²']);
    expect(propertyFacts({ rooms: 0, bathrooms: 0, sizeM2: 0 })).toEqual(['Estudio']);
    expect(propertyFacts({})).toEqual([]);
  });

  it('la disponibilidad pasada es inmediata', () => {
    const now = new Date('2026-10-12T10:00:00Z');
    expect(availabilityText('2026-01-01', now)).toBe('Disponible ya');
    expect(availabilityText(undefined, now)).toBe('Disponible ya');
    expect(availabilityText('2026-12-01T00:00:00Z', now)).toBe('Disponible desde el 1 de diciembre de 2026');
  });

  it('la fianza en meses cuando cuadra y si no el importe', () => {
    expect(depositText(2400, 1200)).toMatch(/^2 meses \(2\.?400\s?€\)$/);
    expect(depositText(1000, 1200)).toMatch(/^1\.?000\s?€$/);
    expect(depositText(0, 1200)).toBeNull();
  });

  it('planta, ascensor y estado solo si están informados', () => {
    const base = { _id: 'p', title: 't', address: 'a', availableFrom: '2000-01-01' } as Property;
    expect(propertyFeatures(base)).toEqual(['Disponible ya', 'Sin amueblar', 'No admite mascotas']);
    expect(propertyFeatures({ ...base, floor: 0, hasElevator: false, condition: 'reformado' })).toContain('Planta baja, sin ascensor');
    expect(propertyFeatures({ ...base, floor: 3 })).toContain('3.ª planta');
    expect(propertyFeatures({ ...base, condition: 'reformado' })).toContain('Reformado');
  });

  it('explica cada estado de la solicitud', () => {
    expect(applicationText({ status: 'pending' }).title).toBe('Solicitud enviada');
    expect(applicationText({ status: 'proposed', proposedBy: 'landlord' }).title).toBe('Te han propuesto una visita');
    expect(applicationText({ status: 'proposed', proposedBy: 'tenant' }).title).toBe('Has propuesto una fecha');
    expect(applicationText({ status: 'rejected' }).title).toBe('Solicitud no aceptada');
  });
});
