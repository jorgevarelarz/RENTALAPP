import React from 'react';

interface StatusPillProps {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

const tones: Record<NonNullable<StatusPillProps['tone']>, React.CSSProperties> = {
  neutral: { background: '#e2e8f0', color: '#0f172a' },
  success: { background: '#dcfce7', color: '#166534' },
  warning: { background: '#fef3c7', color: '#92400e' },
  danger: { background: '#fee2e2', color: '#991b1b' },
};

const StatusPill: React.FC<StatusPillProps> = ({ label, tone = 'neutral' }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '.04em',
      textTransform: 'uppercase',
      ...tones[tone],
    }}
  >
    {label}
  </span>
);

export default StatusPill;
