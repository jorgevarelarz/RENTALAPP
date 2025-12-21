import React from 'react';

type CardProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
};

const Card: React.FC<CardProps> = ({ children, style, className }) => (
  <div
    className={className}
    style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, ...style }}
  >
    {children}
  </div>
);

export default Card;
