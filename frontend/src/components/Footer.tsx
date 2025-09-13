import React from 'react';

const Footer: React.FC = () => (
  <footer style={{ borderTop: '1px solid var(--border)', marginTop: 24, padding: '16px 0', color: 'var(--muted)', fontSize: 12 }}>
    <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', padding: '0 16px' }}>
      © {new Date().getFullYear()} Rental · Demo UI
    </div>
  </footer>
);

export default Footer;

