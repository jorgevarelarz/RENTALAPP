import { formatEuros } from './tickets';

type ProLike = { ratingAvg?: number; reviewCount?: number; services?: Array<{ key: string; basePrice?: number | null }> };

/** «4,5 de 5 (3 opiniones)», o null si aún no tiene opiniones (no enseñamos un 0,0). */
export function proRatingText(pro: ProLike) {
  const reviews = Number(pro.reviewCount) || 0;
  if (reviews <= 0) return null;
  const avg = (Number(pro.ratingAvg) || 0).toFixed(1).replace('.', ',');
  return `${avg} de 5 (${reviews} ${reviews === 1 ? 'opinión' : 'opiniones'})`;
}

/** «desde 45,00 €» del servicio pedido, o null si el profesional no ha puesto precio orientativo. */
export function proPriceText(pro: ProLike, service?: string) {
  if (!service) return null;
  const price = pro.services?.find(s => s.key === service)?.basePrice;
  return typeof price === 'number' && Number.isFinite(price) ? `desde ${formatEuros(price)}` : null;
}
