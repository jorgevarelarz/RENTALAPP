import React from 'react';

const LandlordTaxPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Fiscalidad</h1>
      <p style={{ margin: 0, color: '#475569' }}>Descarga documentos y resúmenes para tu gestoría.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Listado de PDFs y exportaciones (mock).</p>
    </div>
  </div>
);

export default LandlordTaxPage;
