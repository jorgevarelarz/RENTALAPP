/** Textos de las incidencias: servicio, historial y fechas en español. */

export const SERVICE_LABELS: Record<string, string> = {
  plumbing: 'Fontanería',
  electricity: 'Electricidad',
  appliances: 'Electrodomésticos',
  locksmith: 'Cerrajería',
  cleaning: 'Limpieza',
  painting: 'Pintura',
  others: 'Otros',
  maintenance: 'Mantenimiento',
};

/** Servicios que se pueden pedir al comunicar una avería (los de los profesionales, pro.model). */
export const TICKET_SERVICES = ['plumbing', 'electricity', 'appliances', 'locksmith', 'cleaning', 'painting', 'others'];
export const TICKET_TITLE_MAX = 120;
export const TICKET_DESCRIPTION_MAX = 2000;
/** Fotos por avería y tamaño de cada una: los límites de POST /api/uploads/images. */
export const TICKET_PHOTOS_MAX = 6;
export const TICKET_PHOTO_BYTES_MAX = 10 * 1024 * 1024;
export const TICKET_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function getServiceLabel(service?: string) {
  if (!service) return 'Sin servicio';
  return SERVICE_LABELS[service] || service.charAt(0).toUpperCase() + service.slice(1);
}

const HISTORY_LABELS: Record<string, string> = {
  opened: 'Incidencia abierta',
  assigned_pro: 'Profesional asignado',
  unassigned_pro: 'Profesional retirado',
  quoted: 'Presupuesto enviado',
  approved_quote: 'Presupuesto aprobado y pagado',
  extra_requested: 'Coste extra solicitado',
  extra_approved: 'Coste extra aprobado',
  extra_rejected: 'Coste extra rechazado',
  completed: 'Trabajo terminado',
  close_requested: 'El profesional pide cerrar',
  validated_and_released: 'Trabajo validado y pago liberado',
  resolved_by_tenant: 'El inquilino confirma la reparación',
};

export function getHistoryLabel(action?: string) {
  if (!action) return 'Actualización';
  return HISTORY_LABELS[action] || 'Actualización';
}

/** Estados que ofrece el filtro: los que el backend asigna de verdad. */
export const TICKET_STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todas' },
  { value: 'open', label: 'Abiertas' },
  { value: 'quoted', label: 'Presupuestadas' },
  { value: 'awaiting_schedule', label: 'Por agendar' },
  { value: 'scheduled', label: 'Agendadas' },
  { value: 'awaiting_validation', label: 'Por validar' },
  { value: 'closed', label: 'Cerradas' },
];

const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
});

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Madrid',
});

const parse = (value?: string | Date | null) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** «12 oct 2026, 10:30» en hora de Madrid. */
export function formatTicketDateTime(value?: string | Date | null) {
  const d = parse(value);
  return d ? dateTimeFormatter.format(d) : '';
}

/** «12 oct 2026» en hora de Madrid. */
export function formatTicketDate(value?: string | Date | null) {
  const d = parse(value);
  return d ? dateFormatter.format(d) : '';
}

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

export function formatEuros(amount?: number | null) {
  return typeof amount === 'number' && Number.isFinite(amount) ? euro.format(amount) : '';
}

type TicketRole = 'tenant' | 'landlord' | 'pro' | string | undefined;

export type TicketForStep = {
  status?: string;
  proId?: string | null;
  escrowId?: string | null;
  quote?: { amount?: number } | null;
  appointment?: { status?: string } | null;
};

/** Qué pasa ahora con la incidencia, dicho a cada parte. */
export function getTicketNextStep(t: TicketForStep, role: TicketRole): string {
  const proposed = t.appointment?.status === 'proposed';
  switch (t.status) {
    case 'open':
      if (role === 'landlord') return t.proId ? 'El profesional prepara el presupuesto.' : 'Elige un profesional para que haga el presupuesto.';
      if (role === 'pro') return 'Envía tu presupuesto al propietario.';
      return t.proId ? 'El profesional prepara el presupuesto.' : 'Tu arrendador está buscando un profesional.';
    case 'quoted':
      if (role === 'landlord') return 'Revisa el presupuesto y apruébalo para que empiece el trabajo.';
      if (role === 'pro') return 'El propietario está revisando tu presupuesto.';
      return 'Tu arrendador está revisando el presupuesto.';
    case 'awaiting_schedule':
    case 'scheduled':
      if (role === 'pro') {
        if (t.status === 'scheduled') return 'Cita confirmada. Cuando termines, márcalo como terminado.';
        return proposed ? 'Esperando a que el inquilino acepte la cita.' : 'Propón al inquilino una fecha para la visita.';
      }
      if (role === 'tenant') {
        if (t.status === 'scheduled') return 'Cita confirmada con el profesional.';
        return proposed ? 'El profesional ha propuesto una cita: acéptala o pide otra fecha.' : 'El profesional te propondrá una fecha para la visita.';
      }
      return t.status === 'scheduled' ? 'Cita confirmada entre el profesional y el inquilino.' : 'El profesional y el inquilino acuerdan la cita.';
    case 'in_progress':
      return role === 'pro' ? 'Cuando termines, márcalo como terminado.' : 'El profesional está trabajando en la reparación.';
    case 'awaiting_validation':
      if (role === 'landlord') return 'El profesional ha terminado. Valida el trabajo para liberar el pago.';
      if (role === 'tenant') return 'El profesional ha terminado. Confirma si la avería está arreglada.';
      return 'Esperando la validación para liberar tu pago.';
    case 'closed':
      return 'Incidencia cerrada.';
    case 'disputed':
      return 'Hay una disputa abierta sobre esta incidencia.';
    default:
      return '';
  }
}

const ERROR_TEXTS: Record<string, string> = {
  invalid_service: 'Elige el tipo de avería.',
  invalid_title: 'Pon un título de hasta 120 caracteres.',
  invalid_description: 'Describe la avería (hasta 2.000 caracteres).',
  invalid_photos: 'Alguna foto no es válida. Quítala y vuelve a subirla.',
  invalid_file_type: 'Solo se admiten fotos JPG, PNG o WebP.',
  contract_not_active: 'Solo se pueden comunicar averías de un contrato activo.',
  contract_not_owned: 'Ese contrato no es tuyo.',
  missing_policy_acceptance: 'Antes tienes que aceptar las condiciones del servicio y el tratamiento de datos.',
  owner_no_stripe_customer: 'Falta configurar tu método de pago antes de aprobar el presupuesto.',
  work_not_completed: 'El profesional aún no ha dado el trabajo por terminado.',
  quote_not_approved: 'El presupuesto aún no está aprobado.',
  quote_locked: 'El presupuesto ya está aprobado y no se puede cambiar.',
  invalid_status: 'Este paso ya no está disponible. Recarga la página.',
  appointment_not_proposed: 'Esa propuesta de cita ya no está pendiente.',
  'ticket already assigned': 'La incidencia ya tiene un profesional asignado.',
  'pro not found': 'Ese profesional ya no está disponible. Busca otro.',
  release_in_progress: 'El pago se está liberando. Recarga en un momento.',
  escrow_not_held: 'El pago ya se liberó.',
};

export function getTicketErrorText(err: any, fallback = 'No se pudo completar la acción.') {
  const code = err?.response?.data?.error;
  return (code && ERROR_TEXTS[code]) || fallback;
}
