import React from 'react';
import Badge from './Badge';
import { getStatusLabel, getStatusTone, STATUS_TONE_STYLES } from '../../utils/statusBadges';

export default function StatusBadge({ status, label }: { status?: string; label?: string }) {
  const tone = STATUS_TONE_STYLES[getStatusTone(status)];
  return (
    <Badge
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide"
      style={{ background: tone.background, borderColor: tone.borderColor, color: tone.color }}
    >
      {getStatusLabel(status, label)}
    </Badge>
  );
}
