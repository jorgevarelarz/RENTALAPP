import { api as client } from '../api/client';

export type LandlordInviteInput = {
  landlordName: string;
  landlordEmail: string;
  landlordPhone?: string;
  propertyAddress?: string;
  propertyCity?: string;
};

export type LandlordInviteItem = {
  id: string;
  landlordName: string;
  landlordEmail: string;
  propertyAddress?: string;
  status: 'invited' | 'accepted' | 'expired';
  /** El último correo con el enlace no salió. */
  emailFailed?: boolean;
  createdAt: string;
  acceptedAt?: string;
  steps: {
    accountCreated: boolean;
    kycVerified: boolean;
    hasProperty: boolean;
    hasActiveContract: boolean;
  };
};

export type AgencyEarningsSummary = {
  monthCents: number;
  monthOperations: number;
  activeContracts: number;
  currentPct: number;
  nextTier: { atCount: number; pct: number; missing: number } | null;
  tiers: { minCount: number; pct: number }[];
  history: { month: string; cents: number }[];
};

export async function createLandlordInvite(input: LandlordInviteInput) {
  const { data } = await client.post('/api/agency/landlords/invite', input);
  return { ...data.invite, emailStatus: data.emailStatus } as LandlordInviteResult;
}

/** Resultado del envío ('not_configured' = servidor sin SMTP); un backend antiguo no lo manda. */
export type LandlordInviteResult = {
  id: string;
  landlordEmail: string;
  status: string;
  expiresAt: string;
  emailStatus?: 'sent' | 'not_configured' | 'failed';
};

/** Enlace nuevo para una invitación sin aceptar (vigente o caducada); el anterior deja de valer. */
export async function resendLandlordInvite(id: string) {
  const { data } = await client.post(`/api/agency/landlords/invites/${encodeURIComponent(id)}/resend`);
  return { ...data.invite, emailStatus: data.emailStatus } as LandlordInviteResult;
}

export async function listLandlordInvites(): Promise<LandlordInviteItem[]> {
  const { data } = await client.get('/api/agency/landlords');
  return data.items || [];
}

export type AgencyPropertyItem = {
  id: string;
  title?: string;
  address?: string;
  city?: string;
  region?: string;
  status: 'draft' | 'active' | 'archived';
  ownerId?: string;
  ownerName?: string;
  /** 'manage': la gestiona la agencia; 'status_only': traspasada al propietario, solo el resumen. */
  agencyAccess: 'manage' | 'status_only';
  agencyTransferredAt?: string;
  hasActiveContract: boolean;
  lastPaidAt?: string;
  /** Solo mientras la gestiona. */
  price?: number;
  deposit?: number;
  openApplications?: number;
  updatedAt?: string;
};

export async function listAgencyProperties(): Promise<AgencyPropertyItem[]> {
  const { data } = await client.get('/api/agency/properties');
  return data.items || [];
}

export async function getEarningsSummary(): Promise<AgencyEarningsSummary> {
  const { data } = await client.get('/api/agency/earnings/summary');
  return data;
}

export async function listEarnings(month?: string) {
  const { data } = await client.get('/api/agency/earnings', { params: { month } });
  return data as { month: string; items: any[] };
}

export async function downloadInvoice(month?: string) {
  const res = await client.get('/api/agency/earnings/invoice', {
    params: { month },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autofactura_rentalapp_${month || 'mes_actual'}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function getInvite(token: string) {
  const { data } = await client.get(`/api/agency-invites/${token}`);
  return data as {
    landlordName: string;
    landlordEmail: string;
    propertyAddress?: string;
    agencyName: string;
    status: 'invited' | 'accepted' | 'expired';
  };
}

export async function acceptInvite(token: string, payload: { password: string; name?: string }) {
  const { data } = await client.post(`/api/agency-invites/${token}/accept`, payload);
  return data as { token: string; user: { _id: string; email: string; role: string; name?: string } };
}
