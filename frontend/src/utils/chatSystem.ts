/** Avisos automáticos que el servidor escribe en los chats (`type: 'system'`), dichos en español. */
const SYSTEM_LABELS: Record<string, string> = {
  TICKET_OPENED: 'Incidencia abierta',
  CLOSE_REQUESTED: 'El profesional ha pedido cerrar la incidencia',
  CLOSED_BY_TENANT: 'Incidencia cerrada',
  PAYMENT_SUCCEEDED: 'Pago realizado',
  PAYMENT_FAILED: 'El pago no se pudo cobrar',
  PAYMENT_PROCESSING: 'Pago en proceso',
  APPOINTMENT_CONFIRMED: 'Cita confirmada',
  APPOINTMENT_ACCEPTED: 'Cita aceptada',
  APPOINTMENT_REJECTED: 'Cita rechazada',
  APPOINTMENT_CANCELLED: 'Cita cancelada',
  APPOINTMENT_RESCHEDULED: 'Cita cambiada de hora',
  SLOT_PROPOSED: 'Propuesta de cita',
  SERVICE_OFFERED: 'Presupuesto enviado',
  OFFER_ACCEPTED: 'Presupuesto aceptado',
  OFFER_REJECTED: 'Presupuesto rechazado',
  SERVICE_DONE: 'Trabajo terminado',
};

/** Texto de un aviso automático. Un código que no se conoce no se enseña en crudo. */
export function systemMessageLabel(code?: string) {
  return (code && SYSTEM_LABELS[code]) || 'Aviso automático';
}
