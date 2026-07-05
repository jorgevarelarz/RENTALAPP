import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Building2 } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <Link to="/" className="auth-brand" aria-label="Volver a la página principal">
          <span className="auth-brand-icon">
            <Building2 size={18} strokeWidth={2.2} />
          </span>
          RentalApp
        </Link>
        <div className="auth-card">
          <Outlet />
        </div>
        <p className="auth-legal">
          Contratos, pagos y firma digital para alquileres completos.
        </p>
      </div>
    </div>
  );
}
