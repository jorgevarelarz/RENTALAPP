import React from 'react';

const Alert: React.FC<{ tone?: 'info'|'warning'|'error'|'success'; children: React.ReactNode }>
  = ({ tone='info', children }) => {
  const bg = tone === 'error' ? '#fee2e2' : tone === 'success' ? '#d1fae5' : tone === 'warning' ? '#fef3c7' : '#e0f2fe';
  const color = tone === 'error' ? '#991b1b' : tone === 'success' ? '#065f46' : tone === 'warning' ? '#92400e' : '#075985';
  return (
    <div style={{ background: bg, color, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
      {children}
    </div>
  );
};

export default Alert;

