import { api as axios } from '../api/client';
import type { ApplicationList } from '@rental-app/types/applications';

export async function listApplications(token?: string | null, params: Record<string, unknown> = {}) {
  const res = await axios.get<ApplicationList>('/api/applications', {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return res.data;
}

export async function listOwnerApplications(token: string, params: Record<string, unknown> = {}) {
  const res = await axios.get<ApplicationList>('/api/applications/owner', {
    params,
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function respondApplication(token: string, id: string, decision: 'accept' | 'reject', reason?: string) {
  const payload: Record<string, unknown> = { decision };
  if (reason) payload.reason = reason;
  const res = await axios.post(`/api/applications/${id}/decision`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function toggleApplicationTenantPro(token: string, id: string, enable: boolean) {
  const res = await axios.post(`/api/applications/${id}/toggle-pro`, { enable }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

export async function sendApplicationMessage(token: string, id: string, message: string) {
  const res = await axios.post(`/api/applications/${id}/message`, { message }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}
