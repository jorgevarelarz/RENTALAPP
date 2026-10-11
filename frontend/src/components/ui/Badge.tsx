import React from 'react';

const Badge: React.FC<{
  children: React.ReactNode;
  tone?: 'default'|'new'|'highlight';
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, tone='default', className, style }) => {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.5,
    whiteSpace: 'nowrap',
    border: '1px solid var(--border)',
    background: 'var(--card)'
  };
  const tones: Record<string, React.CSSProperties> = {
    default: {},
    new: { background: '#ecfeff', borderColor: '#a5f3fc' },
    highlight: { background: '#eef2ff', borderColor: '#c7d2fe' },
  };
  return <span className={className} style={{ ...base, ...tones[tone], ...style }}>{children}</span>;
};

export default Badge;
