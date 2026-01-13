import api from './client';

export type SystemEventItem = {
  _id: string;
  type: string;
  resourceType?: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
};

export type SystemEventsResponse = {
  items: SystemEventItem[];
  total: number;
  page: number;
  pageSize: number;
};

export async function fetchSystemEvents(params?: {
  type?: string;
  resourceType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const res = await api.get('/api/admin/system-events', { params });
  return res.data?.data as SystemEventsResponse;
}
