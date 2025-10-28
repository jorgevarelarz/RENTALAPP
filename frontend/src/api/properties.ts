import { api as client } from '../api/client';

export type SearchParams = {
  q?: string;
  region?: string;
  city?: string;
  priceMin?: number;
  priceMax?: number;
  roomsMin?: number;
  roomsMax?: number;
  bathMin?: number;
  furnished?: boolean;
  petsAllowed?: boolean;
  availableDate?: string;
  nearLng?: number;
  nearLat?: number;
  maxKm?: number;
  onlyTenantPro?: boolean;
  sort?: 'price' | 'createdAt' | 'views';
  dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

export const createProperty = async (token: string, data: any) => {
  const res = await client.post('/api/properties', data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const listProperties = async (params: Partial<SearchParams> = {}) => {
  const res = await client.get('/api/properties', { params });
  const data = res.data;
  if (Array.isArray(data)) return data;
  return (data && Array.isArray(data.items)) ? data.items : [];
};

export const getProperty = async (id: string) => {
  const res = await client.get(`/api/properties/${id}`);
  return res.data;
};

export async function searchProperties(params: SearchParams = {}) {
  const { data } = await client.get('/api/properties', { params });
  return data as { items: any[]; page: number; limit: number; total: number };
}

export async function favoriteProperty(id: string) {
  const { data } = await client.post(`/api/properties/${id}/favorite`);
  return data;
}

export async function unfavoriteProperty(id: string) {
  const { data } = await client.delete(`/api/properties/${id}/favorite`);
  return data;
}

export async function incrementView(id: string) {
  try {
    await client.post(`/api/properties/${id}/view`);
  } catch (error) {
    // ignore
  }
}

export async function applyToProperty(id: string) {
  const { data } = await client.post(`/api/properties/${id}/apply`);
  return data as { ok: boolean };
}
