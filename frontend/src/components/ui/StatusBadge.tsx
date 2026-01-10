import React from 'react';

const DEFAULT_TONE = { bg: '#f3f4f6', text: '#374151' };

const STATUS_TONES: Record<string, { bg: string; text: string }> = {
  active: { bg: '#dcfce7', text: '#166534' },
  signed: { bg: '#e0f2fe', text: '#075985' },
  pending_signature: { bg: '#fef3c7', text: '#92400e' },
  draft: { bg: '#f3f4f6', text: '#4b5563' },
  completed: { bg: '#e5e7eb', text: '#374151' },
  terminated: { bg: '#fee2e2', text: '#991b1b' },
  cancelled: { bg: '#fee2e2', text: '#991b1b' },
  open: { bg: '#e0f2fe', text: '#075985' },
  quoted: { bg: '#fef3c7', text: '#92400e' },
  awaiting_schedule: { bg: '#fef3c7', text: '#92400e' },
  scheduled: { bg: '#dcfce7', text: '#166534' },
  in_progress: { bg: '#e0e7ff', text: '#3730a3' },
  awaiting_approval: { bg: '#fef3c7', text: '#92400e' },
  done: { bg: '#dcfce7', text: '#166534' },
  closed: { bg: '#e5e7eb', text: '#374151' },
  pending: { bg: '#fef3c7', text: '#92400e' },
  processing: { bg: '#e0e7ff', text: '#3730a3' },
  succeeded: { bg: '#dcfce7', text: '#166534' },
  failed: { bg: '#fee2e2', text: '#991b1b' },
  refunded: { bg: '#e5e7eb', text: '#374151' },
};

export default function StatusBadge({ status, label }: { status?: string; label?: string }) {
  const tone = (status && STATUS_TONES[status]) || DEFAULT_TONE;
  const text = label || status || 'estado';
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium uppercase tracking-wide"
      style={{ background: tone.bg, color: tone.text }}
    >
      {text.replace(/_/g, ' ')}
    </span>
  );
}
