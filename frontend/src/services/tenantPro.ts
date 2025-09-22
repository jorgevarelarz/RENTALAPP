import { api as axios } from '../api/client';

export type TenantProInfo = {
  status?: 'none' | 'pending' | 'verified' | 'rejected';
  maxRent?: number;
  consentAccepted?: boolean;
  consentTextVersion?: string;
  consentAcceptedAt?: string;
  lastDecisionAt?: string;
  docs?: Array<any>;
  ttlDays?: number;
};

export async function getTenantProInfo(): Promise<TenantProInfo> {
  const { data } = await axios.get(`/api/tenant-pro/me`);
  return data;
}

export async function acceptTenantProConsent(version: string) {
  await axios.post(`/api/tenant-pro/consent`, { consent: true, version });
}

export async function uploadTenantProDoc(type: string, file: File) {
  const form = new FormData();
  form.append('type', type);
  form.append('file', file);
  await axios.post(`/api/tenant-pro/docs`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function listPendingTenantPro(): Promise<any[]> {
  const { data } = await axios.get(`/api/admin/tenant-pro/pending`);
  return data;
}

export async function decideTenantPro(userId: string, decision: 'approved' | 'rejected', maxRent: number) {
  await axios.post(`/api/admin/tenant-pro/${userId}/decision`, { decision, maxRent });
}

export async function purgeTenantPro(userId: string) {
  await axios.post(`/api/admin/tenant-pro/${userId}/purge`);
}
