import { api as axios } from '../api/client';

export const downloadDemoContract = async (token: string, payload: any) => {
  const res = await axios.post(`/api/contracts/demo`, payload, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });
  return res.data as Blob;
};

export const listContracts = async (token?: string | null, params: Record<string, any> = {}) => {
  const config: any = { params };
  if (token) {
    config.headers = { Authorization: `Bearer ${token}` };
  }
  const res = await axios.get(`/api/contracts`, config);
  return res.data as { items: any[]; total?: number; page?: number; limit?: number };
};

export const getContract = async (token: string, id: string) => {
  const res = await axios.get(`/api/contracts/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as any;
};

export const sendToSignature = async (token: string, id: string) => {
  const res = await axios.post(`/api/contracts/${id}/signature`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as { status: string; envelopeId?: string; recipientUrls?: { landlordUrl?: string; tenantUrl?: string } };
};

export const signContract = async (token: string, id: string) => {
  const res = await axios.patch(`/api/contracts/${id}/sign`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as any;
};

export const initiateContractPayment = async (token: string, id: string, amount?: number) => {
  const res = await axios.post(
    `/api/contracts/${id}/pay`,
    amount !== undefined ? { amount } : {},
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return res.data as { message: string; clientSecret?: string };
};

export const payDeposit = async (
  token: string,
  id: string,
  options: {
    destination?: 'escrow' | 'authority';
    successUrl?: string;
    cancelUrl?: string;
  } = {},
) => {
  const payload = {
    destination: options.destination ?? 'escrow',
    successUrl: options.successUrl,
    cancelUrl: options.cancelUrl,
  };
  const res = await axios.post(`/api/contracts/${id}/deposit`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as { message: string; contract?: any; sessionUrl?: string };
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
