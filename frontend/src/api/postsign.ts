import { api } from './axios';

export type UpsellService = { id?: string; _id?: string; name: string; logo: string; url: string; description?: string; type: string };
export type UpsellState = {
  status: 'pending' | 'remind_later' | 'dismissed' | 'completed';
  remindAt?: string;
  address?: string;
  services: UpsellService[];
};

export const getUpsell = (contractId: string) =>
  api.get<UpsellState>(`/api/postsign/upsell/${contractId}`).then(r => r.data);

export const clickService = (contractId: string, serviceId: string) =>
  api.post(`/api/postsign/upsell/${contractId}/click`, { serviceId });

export const remindLater = (contractId: string, payload?: { minutes?: number; hours?: number; days?: number }) =>
  api.post(`/api/postsign/upsell/${contractId}/remind-later`, payload).then(r => r.data as UpsellState);

export const dismissUpsell = (contractId: string) =>
  api.post(`/api/postsign/upsell/${contractId}/dismiss`).then(r => r.data as UpsellState);

