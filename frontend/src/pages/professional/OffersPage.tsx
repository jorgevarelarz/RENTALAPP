import React from 'react';

const ProfessionalOffersPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Ofertas</h1>
      <p style={{ margin: 0, color: '#475569' }}>Envía presupuestos, añade extras y adjunta documentos.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Listado mock de ofertas pendientes.</p>
    </div>
  </div>
);

export default ProfessionalOffersPage;
