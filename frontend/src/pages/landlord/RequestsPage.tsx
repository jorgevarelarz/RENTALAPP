import React from 'react';

const LandlordRequestsPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Solicitudes y visitas</h1>
      <p style={{ margin: 0, color: '#475569' }}>Propón día/hora/ubicación y gestiona servicios de visitas externos.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Calendario y flujo de propuestas pendiente de integración.</p>
    </div>
  </div>
);

export default LandlordRequestsPage;
