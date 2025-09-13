import React from 'react';

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }>
  = ({ children, style }) => (
  <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, ...style }}>
    {children}
  </div>
);

export default Card;

