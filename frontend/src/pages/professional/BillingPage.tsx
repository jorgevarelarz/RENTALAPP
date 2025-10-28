import React from 'react';

const ProfessionalBillingPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Facturación</h1>
      <p style={{ margin: 0, color: '#475569' }}>Facturas emitidas y pagos liberados.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Tabla mock de facturación.</p>
    </div>
  </div>
);

export default ProfessionalBillingPage;
