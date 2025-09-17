import React from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type NavItemProps = {
  to: string;
  children: React.ReactNode;
};

function NavItem({ to, children }: NavItemProps) {
  return (
    <Link to={to} style={{ padding: "8px 12px", borderRadius: 6, textDecoration: "none" }}>
      {children}
    </Link>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: "grid", gridTemplateRows: "56px 1fr", minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 16px",
          borderBottom: "1px solid #eee",
        }}
      >
        <Link to="/" style={{ fontWeight: 800, fontSize: 18 }}>
          RentalApp
        </Link>
        <nav style={{ display: "flex", gap: 8, marginLeft: 12 }}>
          <NavItem to="/properties">Propiedades</NavItem>
          {user?.role === "tenant" && <NavItem to="/contracts">Mis contratos</NavItem>}
          {user?.role === "landlord" && (
            <>
              <NavItem to="/owner/properties">Mis propiedades</NavItem>
              <NavItem to="/contracts">Contratos</NavItem>
            </>
          )}
          {user?.role === "pro" && <NavItem to="/pro/tickets">Incidencias</NavItem>}
          {user?.role === "admin" && <NavItem to="/admin">Admin</NavItem>}
        </nav>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {!user && <NavItem to="/login">Entrar</NavItem>}
          {user && (
            <>
              <span style={{ fontSize: 12, opacity: 0.8 }}>
                {user.email} · {user.role}
              </span>
              <button onClick={logout}>Salir</button>
            </>
          )}
        </div>
      </header>
      <main style={{ padding: 16 }}>
        <Outlet />
      </main>
    </div>
  );
}
