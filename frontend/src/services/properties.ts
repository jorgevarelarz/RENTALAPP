import { api as client } from '../api/client';
import type {
  Property,
  PropertyApplication,
  PropertyFavoritesResponse,
  PropertyListResponse,
} from '../types/property';

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
  sort?: 'price' | 'createdAt' | 'views';
  dir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

export const createProperty = async (token: string, data: Partial<Property>) => {
  const res = await client.post('/api/properties', data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data as Property;
};

export const listProperties = async (params: Partial<SearchParams> = {}) => {
  const res = await client.get('/api/properties', { params });
  const data = res.data as Property[] | Partial<PropertyListResponse>;
  if (Array.isArray(data)) return data;
  return Array.isArray(data.items) ? data.items : [];
};

export const getProperty = async (id: string) => {
  const res = await client.get(`/api/properties/${id}`);
  return res.data as Property;
};

export async function searchProperties(params: SearchParams = {}) {
  const { data } = await client.get('/api/properties', { params });
  return data as PropertyListResponse;
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

export interface Application {
  _id: PropertyApplication['_id'];
  tenant: PropertyApplication['tenant'];
  status: PropertyApplication['status'];
  proposedBy?: PropertyApplication['proposedBy'];
  proposedDate?: PropertyApplication['proposedDate'];
  visitDate?: PropertyApplication['visitDate'];
  createdAt: PropertyApplication['createdAt'];
  message?: PropertyApplication['message'];
}

export async function getPropertyApplications(propertyId: string) {
  const res = await client.get(`/api/properties/${propertyId}/applications`);
  return res.data as { items?: Application[] } | Application[];
}

export async function listMyFavorites() {
  const res = await client.get('/api/properties/favorites');
  return res.data as PropertyFavoritesResponse;
}
