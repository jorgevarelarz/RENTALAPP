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
  return data.invite as { id: string; inviteUrl: string; landlordEmail: string };
}

export async function listLandlordInvites(): Promise<LandlordInviteItem[]> {
  const { data } = await client.get('/api/agency/landlords');
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
