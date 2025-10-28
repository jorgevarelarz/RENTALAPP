import React from 'react';

const AdminDepositsPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Depósitos</h1>
      <p style={{ margin: 0, color: '#475569' }}>Trazabilidad de fianzas y certificados.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Enlace a registros oficiales (mock).</p>
    </div>
  </div>
);

export default AdminDepositsPage;
