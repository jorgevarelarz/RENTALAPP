import React from 'react';

export default function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', padding: 12, borderRadius: 10 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Ha ocurrido un error</div>
      <div style={{ marginBottom: 8 }}>{message}</div>
      {onRetry && (
        <button onClick={onRetry} style={{ border: '1px solid #B91C1C', color: '#B91C1C', background: '#fff', borderRadius: 8, padding: '6px 10px' }}>Reintentar</button>
      )}
    </div>
  );
}

