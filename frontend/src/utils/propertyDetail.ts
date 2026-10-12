import type { Property, PropertyViewerApplication } from '../types/property';

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export const formatRent = (value?: number) => euros.format(Number(value) || 0);

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('es-ES')} ${n === 1 ? one : many}`;

/** «2 habitaciones · 1 baño · 60 m²»; sin habitaciones es un estudio y lo que falta no se enseña. */
export function propertyFacts(p: Pick<Property, 'rooms' | 'bathrooms' | 'sizeM2'>): string[] {
  const facts: string[] = [];
  if (typeof p.rooms === 'number') facts.push(p.rooms > 0 ? plural(p.rooms, 'habitación', 'habitaciones') : 'Estudio');
  if (typeof p.bathrooms === 'number' && p.bathrooms > 0) facts.push(plural(p.bathrooms, 'baño', 'baños'));
  if (typeof p.sizeM2 === 'number' && p.sizeM2 > 0) facts.push(`${p.sizeM2.toLocaleString('es-ES')} m²`);
  return facts;
}

const longDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

/** «Disponible ya» si la fecha ha pasado (o no hay), si no «Disponible desde el 1 de noviembre de 2026». */
export function availabilityText(availableFrom?: string, now = new Date()): string {
  if (!availableFrom) return 'Disponible ya';
  const date = new Date(availableFrom);
  if (Number.isNaN(date.getTime()) || date <= now) return 'Disponible ya';
  return `Disponible desde el ${longDate(date)}`;
}

/** La fianza en meses de renta cuando cuadra («1 mes»), si no el importe. */
export function depositText(deposit?: number, price?: number): string | null {
  if (!deposit || deposit <= 0) return null;
  if (price && price > 0) {
    const months = deposit / price;
    if (Number.isInteger(months) && months >= 1 && months <= 6) {
      return `${plural(months, 'mes', 'meses')} (${formatRent(deposit)})`;
    }
  }
  return formatRent(deposit);
}

const CONDITION_LABELS: Record<string, string> = {
  obra_nueva: 'Obra nueva',
  reformado: 'Reformado',
  buen_estado: 'Buen estado',
  a_reformar: 'A reformar',
};

/** Características que el anuncio sí tiene informadas, en el orden en que las lee un inquilino. */
export function propertyFeatures(p: Property, now = new Date()): string[] {
  const features = [availabilityText(p.availableFrom, now)];
  features.push(p.furnished ? 'Amueblado' : 'Sin amueblar');
  features.push(p.petsAllowed ? 'Admite mascotas' : 'No admite mascotas');
  if (typeof p.floor === 'number') {
    const floor = p.floor === 0 ? 'Planta baja' : `${p.floor}.ª planta`;
    features.push(p.hasElevator === undefined ? floor : `${floor}, ${p.hasElevator ? 'con' : 'sin'} ascensor`);
  } else if (p.hasElevator !== undefined) {
    features.push(p.hasElevator ? 'Con ascensor' : 'Sin ascensor');
  }
  if (p.condition && CONDITION_LABELS[p.condition]) features.push(CONDITION_LABELS[p.condition]);
  if (typeof p.yearBuilt === 'number') features.push(`Construido en ${p.yearBuilt}`);
  return features;
}

/** Qué ve el inquilino que ya pidió visita, según en qué punto está su solicitud. */
export function applicationText(a: PropertyViewerApplication): { title: string; detail: string } {
  const sent = a.createdAt ? `Enviaste la solicitud el ${longDate(a.createdAt)}.` : 'Ya enviaste la solicitud.';
  switch (a.status) {
    case 'scheduled':
      return {
        title: 'Visita concertada',
        detail: a.visitDate
          ? `El ${longDate(a.visitDate)} a las ${new Date(a.visitDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`
          : sent,
      };
    case 'proposed':
      return a.proposedBy === 'landlord'
        ? { title: 'Te han propuesto una visita', detail: 'Acéptala o propón otra fecha desde tus solicitudes.' }
        : { title: 'Has propuesto una fecha', detail: 'Falta que el propietario la confirme.' };
    case 'rejected':
      return { title: 'Solicitud no aceptada', detail: 'El propietario ha seguido con otros candidatos.' };
    default:
      return { title: 'Solicitud enviada', detail: `${sent} El propietario te propondrá una fecha de visita.` };
  }
}

/** Ingresos orientativos para que la renta no pase del 35 % (criterio habitual de solvencia). */
// rent * 100 / 35 en vez de rent / 0.35: 1400 / 0.35 da 4000,0000000000005 y redondearía a 4001
export const recommendedIncome = (rent?: number) => Math.ceil(((Number(rent) || 0) * 100) / 35);
