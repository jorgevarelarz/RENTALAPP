import React from 'react';
import Badge from './ui/Badge';
import { getStatusLabel, getStatusTone, STATUS_TONE_STYLES } from '../utils/statusBadges';

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

const CONTRACT_BADGE_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Visita aceptada',
  proposed: 'Visita propuesta',
  scheduled: 'Visita agendada',
  rejected: 'Rechazada',
  pending_signature: 'Pendiente firma',
  signing: 'Pendiente firma',
  signed: 'Firmado',
};

export const ContractStatusBadge: React.FC<Props> = ({ status, className, style }) => {
  const tone = STATUS_TONE_STYLES[getStatusTone(status)];

  return (
    <Badge
      className={className}
      style={{ ...tone, ...style }}
    >
      {CONTRACT_BADGE_LABELS[status] || getStatusLabel(status)}
    </Badge>
  );
};
