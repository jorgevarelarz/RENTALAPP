import React from 'react';

const LandlordDepositsPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Fianzas</h1>
      <p style={{ margin: 0, color: '#475569' }}>Asistente guiado por CCAA, justificantes y trazabilidad hash.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Tablero para registrar depósitos oficiales. Mock preparado para fase 1.</p>
    </div>
  </div>
);

export default LandlordDepositsPage;
