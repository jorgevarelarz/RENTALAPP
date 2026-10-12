import { api as axios } from '../api/client';

export type ProServiceEntry = { key: string; basePrice?: number };
export type ProProfile = { _id: string; displayName: string; city: string; services: ProServiceEntry[]; active: boolean; verified?: boolean };
export type ProProfileInput = { displayName: string; city: string; services: ProServiceEntry[]; active: boolean };

/** Perfil público del profesional autenticado, o null si aún no lo ha creado. */
export const getMyProProfile = async (): Promise<ProProfile | null> => {
  try {
    const res = await axios.get('/api/pros/me');
    return res.data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
};

export const saveProProfile = async (data: ProProfileInput): Promise<ProProfile> => {
  const res = await axios.post('/api/pros', data);
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
