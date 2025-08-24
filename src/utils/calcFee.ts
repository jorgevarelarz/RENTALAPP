export interface FeeBreakdown {
  gross: number; // EUR
  fee: number; // EUR
  netToPro: number; // EUR
}

export function calcPlatformFee(gross: number): FeeBreakdown {
  const pct = Number(process.env.PLATFORM_FEE_PCT ?? 10);
  const minCents = Number(process.env.PLATFORM_MIN_FEE_CENTS ?? 199);

  const feePct = Math.max(0, pct) / 100;
  const fee = Math.max(
    Math.round((gross * 100) * feePct),
    minCents
  ) / 100;

  const netToPro = Math.max(0, +(gross - fee).toFixed(2));
  return { gross: +gross.toFixed(2), fee: +fee.toFixed(2), netToPro };
}

