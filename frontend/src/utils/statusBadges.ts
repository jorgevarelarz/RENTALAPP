import { getContractStatusLabel } from './contractWorkflow';

export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const STATUS_TONE_STYLES: Record<StatusTone, { background: string; borderColor: string; color: string }> = {
  neutral: { background: '#f3f4f6', borderColor: '#e5e7eb', color: '#374151' },
  info: { background: '#dbeafe', borderColor: '#bfdbfe', color: '#1d4ed8' },
  warning: { background: '#fef3c7', borderColor: '#fde68a', color: '#92400e' },
  success: { background: '#dcfce7', borderColor: '#bbf7d0', color: '#166534' },
  danger: { background: '#fee2e2', borderColor: '#fecaca', color: '#991b1b' },
};

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
