export function calcPlatformFeeOnRent(rentCents: number) {
  const pct = Number(process.env.PLATFORM_RENT_FEE_PCT || 0) / 100;
  const min = Number(process.env.PLATFORM_MIN_RENT_FEE_CENTS || 0);
  return Math.max(Math.round(rentCents * pct), min);
}

// Surcharge to tenant to cover Stripe fees for card/bizum; SEPA has no surcharge
export function calcSurchargeCents(method: 'sepa_debit'|'card'|'bizum', rentCents: number) {
  if (method === 'sepa_debit') return 0;
  if (method === 'bizum') return 20; // €0.20
  const rate = 0.014; // 1.4%
  const fixedCents = 25; // €0.25
  const s = (fixedCents + Math.round(rate * rentCents)) / (1 - rate);
  return Math.ceil(s);
}
