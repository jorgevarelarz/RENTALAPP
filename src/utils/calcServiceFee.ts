import { FeeBreakdown } from './calcFee';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcServiceFee(
  amount: number,
  percent = Number(process.env.SERVICE_FEE_PERCENT ?? 0.07)
): FeeBreakdown {
  const pct = Math.max(0, percent);
  const fee = round2(amount * pct);
  const netToPro = round2(amount - fee);
  return { gross: round2(amount), fee, netToPro };
}
