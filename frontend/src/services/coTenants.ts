import { api as client } from '../api/client';

export type CoTenantInvitePreview = {
  email: string;
  expired: boolean;
  inviterName?: string;
  property?: { title?: string; address?: string; city?: string };
};

export type ContractParty = {
  partyId: string;
  role: 'TENANT';
  status: 'INVITED' | 'JOINED' | 'SIGNED' | 'REJECTED' | 'REMOVED_PENDING_ADMIN' | 'REMOVED';
  email?: string;
  signedAt?: string;
  invitedAt?: string;
  /** Solo en invitaciones pendientes. */
  expiresAt?: string;
  expired?: boolean;
  user?: { id: string; name?: string; avatar?: string };
};

export type MyCoTenantInvite = {
  partyId: string;
  contractId: string;
  email: string;
  invitedAt?: string;
  expiresAt?: string;
  expired: boolean;
  landlordName?: string;
  property?: { id: string; title?: string; address?: string; city?: string };
};

/** Invitaciones de co-titular pendientes dirigidas al correo del usuario. */
export async function listMyCoTenantInvites() {
  const { data } = await client.get('/api/me/invites');
  return (data?.items ?? []) as MyCoTenantInvite[];
}

/** Vista previa pública: el invitado puede no tener cuenta todavía. */
export async function getCoTenantInvitePreview(token: string) {
  const { data } = await client.get('/api/invites/preview', { params: { token } });
  return data as CoTenantInvitePreview;
}

export async function acceptCoTenantInvite(token: string) {
  const { data } = await client.post('/api/invites/accept', { token });
  return data as { ok: boolean; partyId: string; contractId: string };
}

export async function listContractParties(contractId: string) {
  const { data } = await client.get(`/api/contracts/${contractId}/parties`);
  return (data?.items ?? []) as ContractParty[];
}

export async function inviteCoTenant(contractId: string, email: string) {
  const { data } = await client.post(`/api/contracts/${contractId}/tenants/invite`, { email });
  return data as { ok: boolean; partyId: string };
}

/** Enlace nuevo para una invitación sin aceptar; el anterior deja de valer. */
export async function resendCoTenantInvite(contractId: string, partyId: string) {
  const { data } = await client.post(`/api/contracts/${contractId}/tenants/${partyId}/resend`);
  return data as { ok: boolean; partyId: string; expiresAt: string };
}

export async function signAsCoTenant(contractId: string, partyId: string) {
  const { data } = await client.post(`/api/contracts/${contractId}/tenants/${partyId}/sign`);
  return data as { ok: boolean; contractStatus: string };
}

/** Solo rutas internas: evita redirecciones a otros dominios (`//evil`, `https://…`). */
export function safeInternalPath(value: string | null | undefined, fallback: string) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : fallback;
}
