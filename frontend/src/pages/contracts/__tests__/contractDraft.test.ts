import { describe, expect, it } from 'vitest';
import { buildContractPayload, contractCreateError, contractEndDate, contractRegion } from '../contractDraft';

const draft = {
  startDate: '2026-11-01',
  durationYears: 2,
  rent: 900,
  deposit: 900,
  petsAllowed: true,
  petsLimit: 2,
  sublettingAllowed: false,
  professionalUse: false,
  graceDays: 5,
};

describe('contractDraft', () => {
  it('traduce la región libre del inmueble a la del catálogo de cláusulas', () => {
    expect(contractRegion('Comunidad de Madrid')).toBe('madrid');
    expect(contractRegion('A Coruña, Galicia')).toBe('galicia');
    expect(contractRegion('Cataluña')).toBe('catalunya');
    expect(contractRegion('catalunya')).toBe('catalunya');
    expect(contractRegion('Andalucía')).toBeNull();
    expect(contractRegion('')).toBeNull();
  });

  it('calcula la fecha de fin sumando años', () => {
    expect(contractEndDate('2026-11-01', 2)).toBe('2028-11-01');
    expect(contractEndDate('', 1)).toBe('');
  });

  it('arma el cuerpo que espera POST /api/contracts', () => {
    const payload = buildContractPayload(
      draft,
      { _id: 'p1', owner: 'owner1', region: 'Comunidad de Madrid' },
      'tenant1',
    );
    expect(payload).toMatchObject({
      landlord: 'owner1',
      tenant: 'tenant1',
      property: 'p1',
      region: 'madrid',
      rent: 900,
      deposit: 900,
      startDate: '2026-11-01',
      endDate: '2028-11-01',
    });
    expect(payload.clauses).toEqual([
      { id: 'duracion_prorroga', params: { mesesIniciales: 24, mesesProrroga: 12 } },
      { id: 'uso_vivienda', params: { permiteActividadProfesional: false } },
      { id: 'mascotas', params: { permitidas: true, limite: 2 } },
      { id: 'subarriendo', params: { permitido: false } },
      { id: 'retraso_pago', params: { diasGracia: 5, recargoPct: 0 } },
      { id: 'fianza_autonomica', params: {} },
    ]);
  });

  it('sin mascotas manda límite 0 y acepta el dueño poblado', () => {
    const payload = buildContractPayload(
      { ...draft, petsAllowed: false },
      { _id: 'p1', owner: { _id: 'owner1' }, region: 'Galicia' },
      't',
    );
    expect(payload.landlord).toBe('owner1');
    expect(payload.clauses.find((c) => c.id === 'mascotas')?.params).toEqual({ permitidas: false, limite: 0 });
  });

  it('explica en español los errores del backend', () => {
    expect(contractCreateError({ response: { data: { error: 'landlord_not_owner' } } })).toBe(
      'El arrendador tiene que ser el propietario del inmueble.',
    );
    expect(contractCreateError({ response: { data: { error: 'Ya existe un contrato activo vigente' } } })).toBe(
      'Este inmueble ya tiene un contrato vigente.',
    );
    expect(contractCreateError({ response: { data: { error: 'Otro problema' } } })).toBe('Otro problema');
    expect(contractCreateError(new Error('x'))).toBe('No se pudo crear el contrato.');
  });
});
