import React from 'react';
import { useAuth } from '../../context/AuthContext';
import ProBadge from '../../components/ui/ProBadge';

export default function TenantApplications() {
  const { user } = useAuth();
  const isTenantPro = user?.role === 'tenant' && user?.tenantPro?.status === 'verified';
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Solicitudes</h2>
      {isTenantPro && (
        <div style={{ marginBottom: 8 }}>
          <ProBadge maxRent={user?.tenantPro?.maxRent} />
        </div>
      )}
      <p>Listado de solicitudes de alquiler en curso.</p>
    </div>
  );
}
