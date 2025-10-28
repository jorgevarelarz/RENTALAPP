import React from 'react';

const AdminUsersPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Usuarios</h1>
      <p style={{ margin: 0, color: '#475569' }}>KYC y niveles PRO centralizados.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Tabla de revisión de usuarios (mock).</p>
    </div>
  </div>
);

export default AdminUsersPage;
