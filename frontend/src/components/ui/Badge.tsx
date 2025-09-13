import React from 'react';

const colors: Record<string, string> = {
  active: '#22c55e',
  draft: '#6b7280',
  signed: '#0ea5e9',
  cancelled: '#ef4444',
  completed: '#a855f7',
};

const Badge: React.FC<{ children: React.ReactNode; tone?: keyof typeof colors }>
  = ({ children, tone = 'draft' }) => (
  <span style={{
    fontSize: 12,
    fontWeight: 700,
    color: 'white',
    background: colors[tone] || '#6b7280',
    padding: '4px 8px',
    borderRadius: 999,
  }}>{children}</span>
);

export default Badge;

