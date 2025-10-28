import React from 'react';
import AdminDemoToggle from './AdminDemoToggle';

const AdminDashboardPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Panel de auditoría</h1>
      <p style={{ margin: 0, color: '#475569' }}>Logs, flags y vista general del sistema.</p>
    </header>
    <AdminDemoToggle />
  </div>
);

export default AdminDashboardPage;
