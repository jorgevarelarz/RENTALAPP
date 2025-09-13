import React from 'react';

const Spinner: React.FC<{ size?: number }>= ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
    <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="4" fill="none" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="var(--primary)" strokeWidth="4" fill="none" />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}} svg{transform-origin:center}`}</style>
  </svg>
);

export default Spinner;

