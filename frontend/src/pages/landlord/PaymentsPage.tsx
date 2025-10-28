import React from 'react';

const LandlordPaymentsPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Pagos</h1>
      <p style={{ margin: 0, color: '#475569' }}>Cobros, split de comisiones y conciliación con SEPA/escrow.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Resumen mock de pagos; pendiente integración Stripe Connect.</p>
    </div>
  </div>
);

export default LandlordPaymentsPage;
