import { api as axios } from '../api/client';
import type { Incident, IncidentList } from '@rental-app/types/incidents';

type IncidentScope = 'tenant' | 'owner' | 'pro';

function pathFor(scope: IncidentScope) {
  if (scope === 'owner') return '/api/tickets/my/owner';
  if (scope === 'pro') return '/api/tickets/my/pro';
  return '/api/tickets/my/tenant';
}

export async function listIncidents(scope: IncidentScope, token?: string | null, params: Record<string, unknown> = {}) {
  const res = await axios.get<IncidentList>(pathFor(scope), {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return res.data;
}

export async function createIncident(token: string, payload: Partial<Incident>) {
  const res = await axios.post('/api/tickets', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as Incident;
}
