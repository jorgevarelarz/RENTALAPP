import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => (
  <div style={{ display: 'grid', placeItems: 'center', minHeight: '80vh', gap: 16 }}>
    <div style={{ textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, marginBottom: 8 }}>404</h1>
      <p style={{ color: '#475569' }}>La página que buscas no existe.</p>
      <Link to="/" style={{ color: '#111827', textDecoration: 'underline' }}>Volver al inicio</Link>
    </div>
  </div>
);

export default NotFoundPage;
