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
  user?: { id: string; name?: string; avatar?: string };
};

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

export async function signAsCoTenant(contractId: string, partyId: string) {
  const { data } = await client.post(`/api/contracts/${contractId}/tenants/${partyId}/sign`);
  return data as { ok: boolean; contractStatus: string };
}

/** Solo rutas internas: evita redirecciones a otros dominios (`//evil`, `https://…`). */
export function safeInternalPath(value: string | null | undefined, fallback: string) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : fallback;
}
