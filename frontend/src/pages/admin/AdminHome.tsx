import React from 'react';
import { Link } from 'react-router-dom';

export default function AdminHome() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Inicio (Admin)</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/admin/tenant-pro" className="px-3 py-1.5 rounded border border-gray-300">KYC / Tenant PRO</Link>
        <Link to="/admin/users" className="px-3 py-1.5 rounded border border-gray-300">Usuarios</Link>
        <Link to="/admin/properties" className="px-3 py-1.5 rounded border border-gray-300">Propiedades</Link>
      </div>
    </div>
  );
}
