import React from 'react';

const AgencyContractsPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Contratos asistidos</h1>
      <p style={{ margin: 0, color: '#475569' }}>Gestión de contratos en nombre del propietario.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Flujo de seguimiento y firma (mock).</p>
    </div>
  </div>
);

export default AgencyContractsPage;
