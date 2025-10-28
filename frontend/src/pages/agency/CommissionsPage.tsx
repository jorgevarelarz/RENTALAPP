import React from 'react';

const AgencyCommissionsPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Comisiones</h1>
      <p style={{ margin: 0, color: '#475569' }}>Liquidaciones y seguimiento de pagos a la agencia.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Resumen mock de comisiones.</p>
    </div>
  </div>
);

export default AgencyCommissionsPage;
