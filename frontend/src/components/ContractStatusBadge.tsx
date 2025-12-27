import React from 'react';
import Badge from './ui/Badge';

type ContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'signing'
  | 'signed'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'terminated'
  | string;

interface Props {
  status: ContractStatus;
  className?: string;
  style?: React.CSSProperties;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; style: React.CSSProperties }
> = {
  draft: {
    label: 'Borrador',
    style: { background: '#f3f4f6', borderColor: '#e5e7eb', color: '#374151' },
  },
  signing: {
    label: 'En firma',
    style: { background: '#fef9c3', borderColor: '#fde047', color: '#92400e' },
  },
  pending_signature: {
    label: 'Pendiente firma',
    style: { background: '#fef9c3', borderColor: '#fde047', color: '#92400e' },
  },
  pending: {
    label: 'Pendiente',
    style: { background: '#fef9c3', borderColor: '#fde047', color: '#92400e' },
  },
  accepted: {
    label: 'Visita aceptada',
    style: { background: '#dcfce7', borderColor: '#bbf7d0', color: '#166534' },
  },
  proposed: {
    label: 'Visita propuesta',
    style: { background: '#dbeafe', borderColor: '#bfdbfe', color: '#1d4ed8' },
  },
  scheduled: {
    label: 'Visita agendada',
    style: { background: '#dcfce7', borderColor: '#bbf7d0', color: '#166534' },
  },
  rejected: {
    label: 'Rechazada',
    style: { background: '#fee2e2', borderColor: '#fecaca', color: '#991b1b' },
  },
  signed: {
    label: 'Firmado (pendiente pago)',
    style: { background: '#dbeafe', borderColor: '#bfdbfe', color: '#1d4ed8' },
  },
  active: {
    label: 'Activo',
    style: { background: '#dcfce7', borderColor: '#bbf7d0', color: '#166534' },
  },
  completed: {
    label: 'Finalizado',
    style: { background: '#f9fafb', borderColor: '#e5e7eb', color: '#6b7280' },
  },
  cancelled: {
    label: 'Cancelado',
    style: { background: '#fee2e2', borderColor: '#fecaca', color: '#991b1b' },
  },
  terminated: {
    label: 'Rescindido',
    style: { background: '#fee2e2', borderColor: '#fecaca', color: '#991b1b' },
  },
};

export const ContractStatusBadge: React.FC<Props> = ({ status, className, style }) => {
  const current = STATUS_CONFIG[status] || {
    label: String(status || 'Estado'),
    style: { background: '#f3f4f6', borderColor: '#e5e7eb', color: '#374151' },
  };

  return (
    <Badge
      className={className}
      style={{ ...current.style, ...style }}
    >
      {current.label}
    </Badge>
  );
};
