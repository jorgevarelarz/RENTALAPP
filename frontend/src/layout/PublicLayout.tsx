import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PublicFooter from '../components/PublicFooter';
import Brand from '../components/Brand';
import { roleHome } from '../utils/roleHome';

const NAV_LINKS = [
  { to: '/properties', label: 'Viviendas' },
  { to: '/#producto', label: 'Producto' },
  { to: '/#perfiles', label: 'Para quién' },
];

export default function PublicLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Cerrar el menú al navegar (también con atrás/adelante).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-white ra-public-shell">
      <header className="ra-topbar">
        <div className="ra-topbar-inner">
          <Brand />
          <nav className="ra-public-nav" aria-label="Navegación principal">
            {NAV_LINKS.map((l) => (
              <Link key={l.to} to={l.to}>{l.label}</Link>
            ))}
          </nav>
          <div className="ra-topbar-actions">
            {user ? (
              <Link to={roleHome(user.role)} className="ra-button ra-button-blue ra-button-small">
                Mi cuenta
              </Link>
            ) : (
              <>
                <Link to="/login" className="ra-login-link">Entrar</Link>
                <Link to="/register" className="ra-button ra-button-blue ra-button-small ra-topbar-register">
                  Crear cuenta
                </Link>
              </>
            )}
            <button
              type="button"
              className="ra-topbar-menu-button"
              aria-expanded={menuOpen}
              aria-controls="ra-public-menu"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="ra-public-menu" className="ra-topbar-menu" aria-label="Menú">
            {NAV_LINKS.map((l) => (
              <Link key={l.to} to={l.to}>{l.label}</Link>
            ))}
            {!user && (
              <Link to="/register" className="ra-button ra-button-blue ra-topbar-menu-cta">
                Crear cuenta
              </Link>
            )}
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
