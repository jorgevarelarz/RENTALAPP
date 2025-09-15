export function formatPriceEUR(value: number): string {
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `€${value}`;
  }
}

export function isNew(createdAt?: string | Date, days = 30): boolean {
  if (!createdAt) return false;
  const ts = typeof createdAt === 'string' ? Date.parse(createdAt) : createdAt.getTime();
  if (Number.isNaN(ts)) return false;
  const diffDays = (Date.now() - ts) / (1000 * 60 * 60 * 24);
  return diffDays <= days;
}

