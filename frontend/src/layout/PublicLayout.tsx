import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PublicFooter from '../components/PublicFooter';
import Brand from '../components/Brand';

export default function PublicLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-white ra-public-shell">
      <header className="ra-topbar">
        <div className="ra-topbar-inner">
          <Brand />
          <nav className="ra-public-nav" aria-label="Navegación principal">
            <Link to="/#producto">Producto</Link>
            <Link to="/#perfiles">Para quién</Link>
            <Link
              to="/properties"
              className="ra-nav-properties"
            >
              Viviendas
            </Link>
          </nav>
          <div className="ra-topbar-actions">
            {user ? (
              <Link
                to="/tenant"
                className="ra-button ra-button-blue ra-button-small"
              >
                Mi Cuenta
              </Link>
            ) : (
              <>
                <Link to="/login" className="ra-login-link">Entrar</Link>
                <Link to="/register" className="ra-button ra-button-blue ra-button-small">
                  Crear cuenta <span aria-hidden="true">↗</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
