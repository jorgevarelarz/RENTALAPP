import React from 'react';

const AdminCatalogPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Catálogo de servicios</h1>
      <p style={{ margin: 0, color: '#475569' }}>Utilities, seguros y proveedores externos.</p>
    </header>
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
      <p style={{ margin: 0 }}>Gestión mock de proveedores.</p>
    </div>
  </div>
);

export default AdminCatalogPage;
