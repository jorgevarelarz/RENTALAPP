import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || (process.env as any).VITE_API_URL || 'http://localhost:3000';

export type TenantProInfo = {
  status?: 'none' | 'pending' | 'verified' | 'rejected';
  maxRent?: number;
  consentAccepted?: boolean;
  consentTextVersion?: string;
  consentAcceptedAt?: string;
  lastDecisionAt?: string;
};

export async function getTenantProInfo(): Promise<TenantProInfo> {
  const { data } = await axios.get(`${API_BASE}/api/tenant-pro/me`);
  return data;
}

export async function acceptTenantProConsent(version: string) {
  await axios.post(`${API_BASE}/api/tenant-pro/consent`, { consent: true, version });
}

export async function uploadTenantProDoc(type: string, file: File) {
  const form = new FormData();
  form.append('type', type);
  form.append('file', file);
  await axios.post(`${API_BASE}/api/tenant-pro/docs`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function listPendingTenantPro(): Promise<any[]> {
  const { data } = await axios.get(`${API_BASE}/api/admin/tenant-pro/pending`);
  return data;
}

export async function decideTenantPro(userId: string, decision: 'approved' | 'rejected', maxRent: number) {
  await axios.post(`${API_BASE}/api/admin/tenant-pro/${userId}/decision`, { decision, maxRent });
}

export async function purgeTenantPro(userId: string) {
  await axios.post(`${API_BASE}/api/admin/tenant-pro/${userId}/purge`);
}
