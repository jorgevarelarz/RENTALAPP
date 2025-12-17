import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type NavItemProps = {
  to: string;
  children: React.ReactNode;
};

function NavItem({ to, children }: NavItemProps) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        textDecoration: "none",
        display: 'block',
        fontWeight: active ? 700 : 500,
        background: active ? '#eef2ff' : 'transparent',
        color: active ? '#1e293b' : '#0f172a',
      }}
    >
      {children}
    </Link>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div style={{ display: 'grid', gridTemplateRows: '56px 1fr', minHeight: '100vh' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: '1px solid #eee' }}>
        <button
          aria-label="Toggle sidebar"
          onClick={() => setSidebarOpen(v => !v)}
          style={{ border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, padding: '6px 10px' }}
        >
          ☰
        </button>
        <Link to="/" style={{ fontWeight: 800, fontSize: 18 }}>RentalApp</Link>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {!user && <NavItem to="/login">Entrar</NavItem>}
          {user && (
            <>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{user.email} · {user.role}</span>
              <button onClick={logout}>Salir</button>
            </>
          )}
        </div>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: sidebarOpen ? '240px 1fr' : '0 1fr', transition: 'grid-template-columns .2s ease' }}>
        <aside style={{
          borderRight: sidebarOpen ? '1px solid #eee' : 'none',
          overflow: 'hidden',
          padding: sidebarOpen ? 12 : 0,
        }}>
          {sidebarOpen && (
            <nav style={{ display: 'grid', gap: 4 }}>
              <div style={{ fontSize: 12, opacity: .6, padding: '4px 8px' }}>Inicio</div>
              <NavItem to="/">Centro de funciones</NavItem>
              <div style={{ fontSize: 12, opacity: .6, padding: '4px 8px' }}>General</div>
              <NavItem to="/properties">Propiedades</NavItem>
              <NavItem to="/me/favorites">Favoritos</NavItem>
              {user?.role === 'tenant' && <NavItem to="/contracts">Mis contratos</NavItem>}
              {user?.role === 'landlord' && (
                <>
                  <div style={{ fontSize: 12, opacity: .6, padding: '8px 8px 4px' }}>Propietario</div>
                  <NavItem to="/owner/properties">Mis propiedades</NavItem>
                  <NavItem to="/contracts">Contratos</NavItem>
                  <NavItem to="/earnings">Ingresos</NavItem>
                </>
              )}
              {user?.role === 'pro' && (
                <>
                  <div style={{ fontSize: 12, opacity: .6, padding: '8px 8px 4px' }}>Profesional</div>
                  <NavItem to="/pro">Panel PRO</NavItem>
                  <NavItem to="/pro/tickets">Incidencias</NavItem>
                </>
              )}
              {user?.role === 'admin' && (
                <>
                  <div style={{ fontSize: 12, opacity: .6, padding: '8px 8px 4px' }}>Administración</div>
                  <NavItem to="/admin">Panel admin</NavItem>
                  <NavItem to="/earnings">Ingresos</NavItem>
                  <NavItem to="/admin/compliance">Compliance</NavItem>
                </>
              )}
            </nav>
          )}
        </aside>
        <main style={{ padding: 16 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
