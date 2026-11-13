/** Estados de las incidencias del profesional, agrupados como los cuenta GET /api/tickets/my/pro/summary. */
export const PRO_PENDING_STATUSES = 'awaiting_schedule,scheduled,in_progress,awaiting_validation';
export const PRO_BILLABLE_STATUSES = `${PRO_PENDING_STATUSES},closed`;

type BillableTicket = { quote?: { amount?: number } | null; extra?: { amount?: number; status?: string } | null };

/** Presupuesto más el extra aprobado: lo que se libera al profesional al validar el trabajo. */
export function billableAmounts(t: BillableTicket) {
  const quote = Number(t.quote?.amount) || 0;
  const extra = t.extra?.status === 'approved' ? Number(t.extra?.amount) || 0 : 0;
  return { quote, extra, total: quote + extra };
}
