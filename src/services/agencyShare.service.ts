import { Types } from 'mongoose';
import { Contract } from '../models/contract.model';
import { getAgencySharePctFromEnv, clampPct } from '../utils/partnerEarnings';

export type ShareTier = { minCount: number; pct: number };

/**
 * Parsea AGENCY_SHARE_TIERS con formato "1:15,10:20,20:25,30:30"
 * (a partir de N contratos activos → % de share). Devuelve [] si no hay tramos.
 */
export function parseShareTiers(raw: string | undefined): ShareTier[] {
  if (!raw) return [];
  const tiers: ShareTier[] = [];
  for (const part of raw.split(',')) {
    const [minStr, pctStr] = part.split(':').map((s) => s?.trim());
    const minCount = Number(minStr);
    if (!Number.isFinite(minCount) || minCount < 0) continue;
    const pct = clampPct(pctStr, -1);
    if (pct < 0) continue;
    tiers.push({ minCount: Math.floor(minCount), pct });
  }
  return tiers.sort((a, b) => a.minCount - b.minCount);
}

/** % que corresponde a un nº de contratos activos según los tramos. */
export function pctForActiveCount(count: number, tiers: ShareTier[], fallbackPct: number): number {
  if (!tiers.length) return fallbackPct;
  let pct: number | undefined;
  for (const tier of tiers) {
    if (count >= tier.minCount) pct = tier.pct;
  }
  return pct ?? 0;
}

/** Siguiente tramo por alcanzar (para el dashboard), o null si ya está en el máximo. */
export function nextTierFor(count: number, tiers: ShareTier[]): ShareTier | null {
  for (const tier of tiers) {
    if (count < tier.minCount) return tier;
  }
  return null;
}

/** Contratos activos que generan comisión para la agencia (gestionados o captados). */
export async function countActiveAgencyContracts(agencyId: string | Types.ObjectId): Promise<number> {
  const id = new Types.ObjectId(String(agencyId));
  return Contract.countDocuments({
    status: 'active',
    $or: [{ agencyId: id }, { refAgencyId: id }],
  });
}

/**
 * % de share vigente para una agencia: tramos por volumen si están configurados
 * (AGENCY_SHARE_TIERS), si no el fijo AGENCY_RENT_FEE_SHARE_PCT.
 */
export async function getAgencySharePct(agencyId: string | Types.ObjectId): Promise<number> {
  const tiers = parseShareTiers(process.env.AGENCY_SHARE_TIERS);
  const fallback = getAgencySharePctFromEnv();
  if (!tiers.length) return fallback;
  const count = await countActiveAgencyContracts(agencyId);
  return pctForActiveCount(count, tiers, fallback);
}
