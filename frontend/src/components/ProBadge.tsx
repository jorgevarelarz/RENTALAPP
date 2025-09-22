import React from 'react';

export default function ProBadge({ maxRent }: { maxRent?: number }) {
  return (
    <span
      style={{
        background: '#dcfce7',
        color: '#166534',
        padding: '2px 6px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
      title="Inquilino PRO (solvencia verificada)"
    >
      PRO {typeof maxRent === 'number' ? `· Hasta ${maxRent} €/mes` : ''}
    </span>
  );
}

