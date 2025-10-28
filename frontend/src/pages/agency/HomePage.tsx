import React from 'react';

const AgencyHomePage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Panel de agencia</h1>
      <p style={{ margin: 0, color: '#475569' }}>Agenda de visitas y conversión de leads.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Widgets de agenda e indicadores vendrán en la siguiente fase.</p>
    </div>
  </div>
);

export default AgencyHomePage;
