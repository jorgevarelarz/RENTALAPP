import React from 'react';
import TenantProPanel from '../components/TenantProPanel';

export default function TenantProPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold">Tenant PRO</h2>
      <p className="text-sm text-gray-600">Sube tu documentación una vez y solicita viviendas Only PRO.</p>
      <TenantProPanel />
    </div>
  );
}

