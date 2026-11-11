import { api } from '../api/client';

/** Estado de la cuenta de cobros (Stripe Connect) de un propietario o una agencia. */
export type PayoutStatus = {
  connected: boolean;
  /** La cuenta ya puede recibir dinero. Sin esto los inquilinos no pueden pagar la renta. */
  ready: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: { currently_due?: string[]; current_deadline?: number | null; disabled_reason?: string | null };
  /** Comisiones vigentes de la plataforma, en porcentaje. */
  fees?: { rentPct: number; signPct: number };
};

export async function getPayoutStatus(): Promise<PayoutStatus> {
  const { data } = await api.get('/api/connect/owner/status');
  return data;
}

/** Enlace al alta (o a la actualización de datos) en Stripe. */
export async function createPayoutLink(): Promise<string> {
  const { data } = await api.post('/api/connect/owner/link');
  if (!data?.url) throw new Error('missing_url');
  return data.url as string;
}
