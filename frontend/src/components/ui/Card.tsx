import React from 'react';

type CardProps = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
};

// Panel blanco del sistema 2026 (.ra-card en index.css, @layer components):
// las utilidades de Tailwind que pase quien llama (p-5, overflow-hidden…) mandan.
const Card: React.FC<CardProps> = ({ children, style, className }) => (
  <div className={className ? `ra-card ${className}` : 'ra-card'} style={style}>
    {children}
  </div>
);

export default Card;
