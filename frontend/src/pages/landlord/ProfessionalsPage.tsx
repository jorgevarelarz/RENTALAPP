import React from 'react';

const LandlordProfessionalsPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Profesionales</h1>
      <p style={{ margin: 0, color: '#475569' }}>Listado de reputación e historial de trabajos.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Tabla con reseñas y KPI (mock).</p>
    </div>
  </div>
);

export default LandlordProfessionalsPage;
