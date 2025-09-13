import axios from 'axios';

const API_BASE =
  process.env.REACT_APP_API_URL || process.env.VITE_API_URL || 'http://localhost:3000';

export const earningsSummary = async (token: string, userId: string, params: { from?: string; to?: string; groupBy?: 'day'|'month' } = {}) => {
  const res = await axios.get(`${API_BASE}/api/admin/earnings/summary`, {
    params,
    headers: { Authorization: `Bearer ${token}`, 'x-user-id': userId, 'x-admin': 'true' },
  });
  return res.data as { from: string; to: string; totals: { gross:number; fee:number; net:number }; items: { period: string; gross:number; fee:number; net:number }[] };
};

export const earningsList = async (token: string, userId: string, params: { from?: string; to?: string; page?: number; limit?: number; proId?: string; ticketId?: string } = {}) => {
  const res = await axios.get(`${API_BASE}/api/admin/earnings/list`, {
    params,
    headers: { Authorization: `Bearer ${token}`, 'x-user-id': userId, 'x-admin': 'true' },
  });
  return res.data as { items: any[]; total: number; page: number; limit: number };
};

export const earningsExportCsv = async (token: string, userId: string, params: { from?: string; to?: string } = {}) => {
  const res = await axios.get(`${API_BASE}/api/admin/earnings/export.csv`, {
    params,
    headers: { Authorization: `Bearer ${token}`, 'x-user-id': userId, 'x-admin': 'true' },
    responseType: 'blob',
  });
  return res.data as Blob;
};
