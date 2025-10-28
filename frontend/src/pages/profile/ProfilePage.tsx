import React from 'react';
import { useAuth } from '../../context/AuthContext';
import ProBadge from '../../components/ui/ProBadge';

export default function ProfilePage() {
  const { user } = useAuth();
  const isTenantPro = user?.role === 'tenant' && user?.tenantPro?.status === 'verified';
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Perfil y cuenta</h2>
      {isTenantPro && (
        <div>
          <ProBadge maxRent={user?.tenantPro?.maxRent} />
        </div>
      )}
      <p>Página de perfil. Aquí podrás actualizar tus datos personales, email y contraseña.</p>
    </div>
  );
}
