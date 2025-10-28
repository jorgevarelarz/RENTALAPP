import React from 'react';

const AdminPaymentsPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Pagos & Escrow</h1>
      <p style={{ margin: 0, color: '#475569' }}>Disputas y liberaciones supervisadas.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Panel de control mock de escrow.</p>
    </div>
  </div>
);

export default AdminPaymentsPage;
