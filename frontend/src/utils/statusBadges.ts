import { getContractStatusLabel } from './contractWorkflow';

export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';


export function getStatusTone(status?: string): StatusTone {
  switch (status) {
    case 'active':
    case 'accepted':
    case 'scheduled':
    case 'done':
    case 'succeeded':
      return 'success';
    case 'signed':
    case 'open':
    case 'quoted':
    case 'in_progress':
    case 'processing':
    case 'proposed':
      return 'info';
    case 'pending_signature':
    case 'signing':
    case 'draft':
    case 'generated':
    case 'awaiting_schedule':
    case 'awaiting_approval':
    case 'awaiting_validation':
    case 'pending':
      return 'warning';
    case 'terminated':
    case 'cancelled':
    case 'rejected':
    case 'failed':
    case 'disputed':
      return 'danger';
    case 'completed':
    case 'closed':
    case 'refunded':
      return 'neutral';
    default:
      return 'neutral';
  }
}

// Estados de incidencias, pagos y solicitudes que no son de contrato. Sin esto, la insignia
// mostraba el valor interno en inglés («in progress»), disimulado antes por las mayúsculas.
const GENERIC_STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  quoted: 'Presupuestada',
  in_progress: 'En curso',
  awaiting_schedule: 'Por agendar',
  scheduled: 'Agendada',
  awaiting_validation: 'Por validar',
  awaiting_approval: 'Por aprobar',
  closed: 'Cerrada',
  disputed: 'En disputa',
  done: 'Hecha',
  pending: 'Pendiente',
  accepted: 'Aceptada',
  proposed: 'Propuesta',
  rejected: 'Rechazada',
  succeeded: 'Pagado',
  processing: 'Procesando',
  failed: 'Fallido',
  refunded: 'Devuelto',
};

export function getStatusLabel(status?: string, label?: string) {
  if (label) return label;
  if (!status) return 'Estado';
  const text = GENERIC_STATUS_LABELS[status] || getContractStatusLabel(status).replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
