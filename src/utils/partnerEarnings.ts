export function parsePositiveInt(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  return i > 0 ? i : undefined;
}

export function clampPct(value: unknown, fallbackPct: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallbackPct;
  return Math.max(0, Math.min(100, Math.floor(n)));
}

export function getAgencySharePctFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  return clampPct(env.AGENCY_RENT_FEE_SHARE_PCT, 20);
}

export function calcPartnerShareCents(platformFeeCents: number, sharePct: number): number {
  if (!Number.isFinite(platformFeeCents) || platformFeeCents <= 0) return 0;
  if (!Number.isFinite(sharePct) || sharePct <= 0) return 0;
  return Math.floor((platformFeeCents * sharePct) / 100);
}

