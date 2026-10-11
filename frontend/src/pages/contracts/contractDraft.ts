// Borrador del asistente de contratos → cuerpo de POST /api/contracts.
// El backend espera { landlord, tenant, property, region, rent, deposit, startDate, endDate, clauses }
// con las cláusulas del catálogo (src/policies/clauses/catalog.v1.ts).

export type ContractDraft = {
  startDate: string;
  durationYears: number;
  rent: number;
  deposit: number;
  petsAllowed: boolean;
  petsLimit: number;
  sublettingAllowed: boolean;
  professionalUse: boolean;
  graceDays: number;
};

export type DraftProperty = {
  _id: string;
  owner?: string | { _id?: string };
  region?: string;
};

export const SUPPORTED_REGIONS: Record<string, string> = {
  madrid: 'Comunidad de Madrid',
  galicia: 'Galicia',
  catalunya: 'Cataluña',
};

// Organismo de la cláusula `fianza_autonomica`, con el mismo texto que el catálogo del backend
export const DEPOSIT_BODY: Record<string, string> = {
  madrid: 'el Instituto de la Vivienda de Madrid (IVIMA)',
  galicia: 'el Instituto Galego da Vivenda e Solo (IGVS)',
  catalunya: "l'Institut Català del Sòl (INCASÒL)",
};

/**
 * La región del inmueble es texto libre («Comunidad de Madrid», «Cataluña», «A Coruña, Galicia»…);
 * el catálogo de cláusulas solo conoce `madrid`, `galicia` y `catalunya`. Devuelve null si no encaja.
 */
export function contractRegion(region?: string): string | null {
  const r = String(region || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (!r) return null;
  if (r.includes('madrid')) return 'madrid';
  if (r.includes('galicia') || r.includes('galiza')) return 'galicia';
  if (r.includes('catalu') || r.includes('catalonia')) return 'catalunya';
  return null;
}

/** Fecha de fin: inicio + años de duración, en formato AAAA-MM-DD. */
export function contractEndDate(startDate: string, years: number): string {
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  const end = new Date(Date.UTC(y + Number(years), m - 1, d));
  return end.toISOString().slice(0, 10);
}

export function ownerId(property: DraftProperty): string {
  const owner = property.owner;
  if (!owner) return '';
  return typeof owner === 'string' ? owner : String(owner._id || '');
}

export function buildContractPayload(draft: ContractDraft, property: DraftProperty, tenantId: string) {
  const region = contractRegion(property.region);
  const clauses: { id: string; params: Record<string, unknown> }[] = [
    { id: 'duracion_prorroga', params: { mesesIniciales: draft.durationYears * 12, mesesProrroga: 12 } },
    { id: 'uso_vivienda', params: { permiteActividadProfesional: draft.professionalUse } },
    {
      id: 'mascotas',
      params: { permitidas: draft.petsAllowed, limite: draft.petsAllowed ? draft.petsLimit : 0 },
    },
    { id: 'subarriendo', params: { permitido: draft.sublettingAllowed } },
    { id: 'retraso_pago', params: { diasGracia: draft.graceDays, recargoPct: 0 } },
  ];
  if (region) clauses.push({ id: 'fianza_autonomica', params: {} });

  return {
    landlord: ownerId(property),
    tenant: tenantId,
    property: property._id,
    region: region || '',
    rent: draft.rent,
    deposit: draft.deposit,
    startDate: draft.startDate,
    endDate: contractEndDate(draft.startDate, draft.durationYears),
    clauses,
  };
}

// Errores de POST /api/contracts
const CREATE_ERRORS: Record<string, string> = {
  property_not_found: 'El inmueble ya no existe.',
  forbidden: 'Solo el propietario del inmueble, la agencia que lo gestiona o un administrador pueden crear el contrato.',
  landlord_not_owner: 'El arrendador tiene que ser el propietario del inmueble.',
  tenant_not_found: 'La cuenta del inquilino ya no existe.',
  tenant_is_landlord: 'El inquilino no puede ser el propio arrendador.',
  region_not_supported: 'Todavía no generamos contratos para la comunidad autónoma de este inmueble.',
  region_mismatch: 'La comunidad autónoma del inmueble ha cambiado. Vuelve a abrir el asistente.',
  invalid_date_range: 'La fecha de fin tiene que ser posterior a la de inicio.',
  invalid_payload: 'Revisa los datos: falta alguno o no es válido.',
  invalid_clause_params: 'Alguna cláusula tiene un valor fuera de rango.',
};

export function contractCreateError(error: any): string {
  const raw = error?.response?.data?.error;
  if (raw && String(raw).toLowerCase().includes('contrato activo vigente')) {
    return 'Este inmueble ya tiene un contrato vigente.';
  }
  return CREATE_ERRORS[raw] || (typeof raw === 'string' && raw) || 'No se pudo crear el contrato.';
}
