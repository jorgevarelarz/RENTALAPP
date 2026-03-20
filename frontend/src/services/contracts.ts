import { api as client } from '../api/client';
import type { Contract } from '../types/contract';

const withAuth = (token?: string) => {
  if (!token) return undefined;
  return { headers: { Authorization: `Bearer ${token}` } };
};

export type ClauseDefinition = {
  id: string;
  label: string;
  version: string;
  paramsMeta: unknown;
};

export type ContractsResponse = { items: Contract[] };

export const downloadDemoContract = async (token: string, payload: Record<string, unknown>) => {
  const res = await client.post(`/api/contracts/demo`, payload, {
    ...withAuth(token),
    responseType: 'blob',
  });
  return res.data as Blob;
};

export const listContracts = async (token: string, params?: Record<string, unknown>) => {
  const res = await client.get(`/api/contracts`, {
    ...withAuth(token),
    params,
  });
  return res.data as ContractsResponse;
};

export const getContract = async (token: string, id: string, signal?: AbortSignal) => {
  const res = await client.get(`/api/contracts/${id}`, {
    ...withAuth(token),
    signal,
  });
  return res.data as Contract;
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
  return res.data as { status?: string; signedAt?: string; envelopeId?: string };
};

export const signContract = async (token: string, id: string) => {
  const res = await client.patch(`/api/contracts/${id}/sign`, {}, {
    ...withAuth(token),
  });
  return res.data as Contract;
};

export const payDeposit = async (token: string, id: string) => {
  const res = await client.post(`/api/contracts/${id}/deposit`, {}, {
    ...withAuth(token),
  });
  return res.data as { ok?: boolean; clientSecret?: string; amount?: number };
};

// Cobrar renta usando método guardado (off-session)
export const payRentWithSavedMethod = async (token: string, id: string) => {
  const res = await client.post(`/api/contracts/${id}/pay-rent-saved`, {}, {
    ...withAuth(token),
  });
  return res.data as { ok?: boolean; paymentId?: string };
};

export const downloadPdf = async (token: string, id: string) => {
  const res = await client.get(`/api/contracts/${id}/pdf`, {
    ...withAuth(token),
    responseType: 'blob',
  });
  return res.data as Blob;
};

export const downloadSignedPdf = async (token: string, id: string) => {
  const res = await client.get(`/api/contracts/${id}/pdf/signed`, {
    ...withAuth(token),
    responseType: 'blob',
  });
  return res.data as Blob;
};

export async function getClauses(region: string, version = '1.0.0') {
  const { data } = await client.get(`/api/clauses`, { params: { region, version } });
  return data as { version: string; region: string; items: ClauseDefinition[] };
}

export async function createContract(payload: Record<string, unknown>) {
  const { data } = await client.post(`/api/contracts`, payload);
  return data.contract as Contract;
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
