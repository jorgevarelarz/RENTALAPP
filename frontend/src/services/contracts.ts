import { api as axios } from '../api/client';

export const downloadDemoContract = async (token: string, payload: any) => {
  const res = await axios.post(`/api/contracts/demo`, payload, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });
  return res.data as Blob;
};

export const listContracts = async (token: string, params?: Record<string, any>) => {
  const res = await axios.get(`/api/contracts`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data as { items: any[] };
};

export const getContract = async (token: string, id: string, signal?: AbortSignal) => {
  const res = await axios.get(`/api/contracts/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  return res.data as any;
};

export const sendToSignature = async (token: string, id: string) => {
  const res = await axios.post(`/api/contracts/${id}/signature/init`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as {
    status: string;
    envelopeId?: string;
    recipientUrls?: { landlordUrl?: string; tenantUrl?: string };
  };
};

export const getSignatureStatus = async (token: string, id: string) => {
  const res = await axios.get(`/api/contracts/${id}/signature/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as any;
};

export const signContract = async (token: string, id: string) => {
  const res = await axios.patch(`/api/contracts/${id}/sign`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as any;
};

export const payDeposit = async (token: string, id: string) => {
  const res = await axios.post(`/api/contracts/${id}/deposit`, { }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as any;
};

// Cobrar renta usando método guardado (off-session)
export const payRentWithSavedMethod = async (token: string, id: string) => {
  const res = await axios.post(`/api/contracts/${id}/pay-rent-saved`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as any;
};

export const downloadPdf = async (token: string, id: string) => {
  const res = await axios.get(`/api/contracts/${id}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });
  return res.data as Blob;
};

export async function getClauses(region: string, version = '1.0.0') {
  const { data } = await axios.get(`/api/clauses`, { params: { region, version } });
  return data as { version: string; region: string; items: Array<{ id: string; label: string; version: string; paramsMeta: any }> };
}

export async function createContract(payload: any) {
  const { data } = await axios.post(`/api/contracts`, payload);
  return data.contract as any;
}

export async function createSignSession(id: string) {
  const { data } = await axios.post(`/api/contracts/${id}/sign-session`);
  return data as { signingUrl?: string };
}

export async function initiatePayment(contractId: string, amount: number) {
  const res = await axios.post(`/api/contracts/${contractId}/pay`, { amount });
  return res.data as { clientSecret?: string };
}
