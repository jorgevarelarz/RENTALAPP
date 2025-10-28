import React from 'react';

interface PROBadgeProps {
  level: string;
  maxRent: number;
}

const PROBadge: React.FC<PROBadgeProps> = ({ level, maxRent }) => (
  <span
    title={`Puedes optar a viviendas hasta ${maxRent.toLocaleString('es-ES')} € / mes`}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: '#111827',
      color: '#fff',
      padding: '6px 10px',
      borderRadius: 999,
      fontSize: 12,
      letterSpacing: '.04em',
    }}
  >
    PRO · {level.replace('PRO_', '')}
  </span>
);

export default PROBadge;
