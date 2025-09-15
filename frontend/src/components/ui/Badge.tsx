import React from 'react';

const Badge: React.FC<{ children: React.ReactNode; tone?: 'default'|'new'|'highlight'; style?: React.CSSProperties }>
  = ({ children, tone='default', style }) => {
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: 6,
    fontSize: 11,
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    border: '1px solid var(--border)',
    background: 'var(--card)'
  };
  const tones: Record<string, React.CSSProperties> = {
    default: {},
    new: { background: '#ecfeff', borderColor: '#a5f3fc' },
    highlight: { background: '#eef2ff', borderColor: '#c7d2fe' },
  };
  return <span style={{ ...base, ...tones[tone], ...style }}>{children}</span>;
};

export default Badge;

