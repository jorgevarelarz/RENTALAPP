import React from 'react';
import { Link } from 'react-router-dom';

export default function TenantHome() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Inicio (Inquilino)</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/properties" className="px-3 py-1.5 rounded border border-gray-300">Buscar pisos</Link>
        <Link to="/tenant-pro" className="px-3 py-1.5 rounded border border-gray-300">Hazte PRO</Link>
        <Link to="/contracts" className="px-3 py-1.5 rounded border border-gray-300">Mis contratos</Link>
      </div>
    </div>
  );
}

