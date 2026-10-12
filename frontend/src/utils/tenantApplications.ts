export type TenantApplicationStatus = 'pending' | 'proposed' | 'scheduled' | 'rejected';

export interface TenantApplication {
  _id: string;
  status: TenantApplicationStatus;
  createdAt?: string;
  proposedDate?: string;
  proposedBy?: 'tenant' | 'landlord';
  visitDate?: string;
  message?: string;
  contractId?: string;
  contractStatus?: string;
  property?: {
    _id: string;
    title?: string;
    address?: string;
    city?: string;
    price?: number;
    images?: string[];
    owner?: { _id: string; name?: string };
  };
}

const valid = (value?: string) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** «el martes, 13 de octubre a las 10:00» (en hora de quien mira). */
export function visitWhen(value?: string): string {
  const d = valid(value);
  if (!d) return '';
  const day = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `el ${day} a las ${time}`;
}

export type Tone = 'action' | 'waiting' | 'done' | 'closed';

/** Una línea de estado para la tarjeta: qué ha pasado y si te toca hacer algo. */
export function applicationStatus(a: TenantApplication, now = new Date()): { text: string; tone: Tone } {
  switch (a.status) {
    case 'scheduled': {
      const when = valid(a.visitDate);
      if (when && when < now) return { text: `Visitaste el piso ${visitWhen(a.visitDate)}`, tone: 'done' };
      return { text: when ? `Visita concertada ${visitWhen(a.visitDate)}` : 'Visita concertada', tone: 'done' };
    }
    case 'proposed': {
      const when = valid(a.proposedDate);
      if (when && when < now) {
        return a.proposedBy === 'landlord'
          ? { text: 'La fecha que te propusieron ya pasó. Propón otra.', tone: 'action' }
          : { text: 'La fecha que propusiste ya pasó. Propón otra.', tone: 'action' };
      }
      return a.proposedBy === 'landlord'
        ? { text: `El propietario te propone visitarlo ${visitWhen(a.proposedDate)}`, tone: 'action' }
        : { text: `Has propuesto visitarlo ${visitWhen(a.proposedDate)}. Falta que el propietario confirme.`, tone: 'waiting' };
    }
    case 'rejected':
      return { text: 'El propietario ha seguido con otros candidatos', tone: 'closed' };
    default:
      return { text: 'Solicitud enviada. El propietario te propondrá una fecha.', tone: 'waiting' };
  }
}

/** ¿Puede el inquilino aceptar la fecha que le proponen? Solo si es del propietario y no ha pasado. */
export function canAccept(a: TenantApplication, now = new Date()): boolean {
  const when = valid(a.proposedDate);
  return a.status === 'proposed' && a.proposedBy === 'landlord' && !!when && when >= now;
}

/** ¿Puede proponer una fecha? Cuando el propietario ya ha propuesto una, o la suya ha caducado. */
export function canPropose(a: TenantApplication, now = new Date()): boolean {
  if (a.status !== 'proposed') return false;
  if (a.proposedBy === 'landlord') return true;
  const when = valid(a.proposedDate);
  return !!when && when < now;
}

/** Valor mínimo para un `datetime-local`: ahora, en hora local y sin segundos. */
export function localDateTimeMin(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export const VISIT_ERRORS: Record<string, string> = {
  invalid_visit_date: 'La fecha no es válida.',
  visitDate_required: 'Elige día y hora.',
  visit_date_in_past: 'Esa fecha ya ha pasado. Elige una a partir de ahora.',
  proposed_date_passed: 'La fecha propuesta ya pasó. Propón otra.',
  application_closed: 'Esta solicitud ya está cerrada.',
  application_not_found: 'Esta solicitud ya no existe.',
  no_proposed_date: 'No hay ninguna fecha que aceptar.',
  forbidden: 'No puedes cambiar esta solicitud.',
};

export const visitError = (error: any) =>
  VISIT_ERRORS[error?.response?.data?.error] || 'No se pudo guardar. Inténtalo de nuevo.';
