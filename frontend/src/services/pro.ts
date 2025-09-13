import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || (process.env as any).VITE_API_URL || 'http://localhost:3000';

export const upsertPro = async (token: string, userId: string, data: { displayName: string; city: string; services: { key: string; basePrice?: number }[] }) => {
  const res = await axios.post(`${API_BASE}/api/pros`, data, { headers: { Authorization: `Bearer ${token}`, 'x-user-id': userId } });
  return res.data;
};

export const getMyPro = async (token: string, userId: string) => {
  const res = await axios.get(`${API_BASE}/api/pros/me`, { headers: { Authorization: `Bearer ${token}`, 'x-user-id': userId } });
  return res.data;
};

export const listPros = async (params: { service?: string; city?: string; page?: number; limit?: number } = {}) => {
  const res = await axios.get(`${API_BASE}/api/pros`, { params });
  return res.data as { items: any[]; total: number; page: number; limit: number };
};

export const getPro = async (id: string) => {
  const res = await axios.get(`${API_BASE}/api/pros/${id}`);
  return res.data;
};

