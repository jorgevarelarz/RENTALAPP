import { api as axios } from '../api/client';

export const upsertPro = async (token: string, userId: string, data: { displayName: string; city: string; services: { key: string; basePrice?: number }[] }) => {
  const res = await axios.post(`/api/pros`, data, { headers: { Authorization: `Bearer ${token}`, 'x-user-id': userId } });
  return res.data;
};

export const getMyPro = async (token: string, userId: string) => {
  const res = await axios.get(`/api/pros/me`, { headers: { Authorization: `Bearer ${token}`, 'x-user-id': userId } });
  return res.data;
};

export const listPros = async (params: { service?: string; city?: string; page?: number; limit?: number } = {}) => {
  const res = await axios.get(`/api/pros`, { params });
  return res.data as { items: any[]; total: number; page: number; limit: number };
};

export const getPro = async (id: string) => {
  const res = await axios.get(`/api/pros/${id}`);
  return res.data;
};
