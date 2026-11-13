import React from 'react';
import Badge from './Badge';
import { getStatusLabel, getStatusTone } from '../../utils/statusBadges';

export default function StatusBadge({ status, label }: { status?: string; label?: string }) {
  return <Badge tone={getStatusTone(status)}>{getStatusLabel(status, label)}</Badge>;
}
