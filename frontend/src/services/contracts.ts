import { api as client } from '../api/client';

const withAuth = (token?: string) => {
  if (!token) return undefined;
  return { headers: { Authorization: `Bearer ${token}` } };
};

export const downloadDemoContract = async (token: string, payload: any) => {
  const res = await client.post(`/api/contracts/demo`, payload, {
    ...withAuth(token),
    responseType: 'blob',
  });
  return res.data as Blob;
};

export const listContracts = async (token: string, params?: Record<string, any>) => {
  const res = await client.get(`/api/contracts`, {
    ...withAuth(token),
    params,
  });
  return res.data as { items: any[] };
};

export const getContract = async (token: string, id: string, signal?: AbortSignal) => {
  const res = await client.get(`/api/contracts/${id}`, {
    ...withAuth(token),
    signal,
  });
  return res.data as any;
};

export const sendToSignature = async (token: string, id: string) => {
  const res = await client.post(`/api/contracts/${id}/signature/init`, {}, {
    ...withAuth(token),
  });
  return res.data as {
    status: string;
    envelopeId?: string;
    recipientUrls?: { landlordUrl?: string; tenantUrl?: string };
  };
};

export const getSignatureStatus = async (token: string, id: string) => {
  const res = await client.get(`/api/contracts/${id}/signature/status`, {
    ...withAuth(token),
  });
  return res.data as any;
};

export const signContract = async (token: string, id: string) => {
  const res = await client.patch(`/api/contracts/${id}/sign`, {}, {
    ...withAuth(token),
  });
  return res.data as any;
};

export const payDeposit = async (token: string, id: string) => {
  const res = await client.post(`/api/contracts/${id}/deposit`, {}, {
    ...withAuth(token),
  });
  return res.data as any;
};

// Cobrar renta usando método guardado (off-session)
export const payRentWithSavedMethod = async (token: string, id: string) => {
  const res = await client.post(`/api/contracts/${id}/pay-rent-saved`, {}, {
    ...withAuth(token),
  });
  return res.data as any;
};

export const downloadPdf = async (token: string, id: string) => {
  const res = await client.get(`/api/contracts/${id}/pdf`, {
    ...withAuth(token),
    responseType: 'blob',
  });
  return res.data as Blob;
};

export async function getClauses(region: string, version = '1.0.0') {
  const { data } = await client.get(`/api/clauses`, { params: { region, version } });
  return data as { version: string; region: string; items: Array<{ id: string; label: string; version: string; paramsMeta: any }> };
}

export async function createContract(payload: any) {
  const { data } = await client.post(`/api/contracts`, payload);
  return data.contract as any;
}

export async function createSignSession(id: string) {
  const { data } = await client.post(`/api/contracts/${id}/sign-session`);
  return data as { signingUrl?: string };
}

export async function initiatePayment(contractId: string, amount: number) {
  const res = await client.post(`/api/contracts/${contractId}/pay`, { amount });
  return res.data as { clientSecret?: string };
}

export async function initiateRentPayment(contractId: string) {
  const res = await client.post(`/api/contracts/${contractId}/pay-rent`);
  return res.data as { clientSecret?: string; amount?: number };
}

export async function getPaymentHistory(contractId: string) {
  const res = await client.get(`/api/contracts/${contractId}/payments`);
  return res.data as Array<{
    _id: string;
    amount: number;
    currency: string;
    status: string;
    concept: string;
    paidAt?: string;
    createdAt?: string;
  }>;
}
