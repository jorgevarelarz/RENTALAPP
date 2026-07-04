import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { formatApiError } from "../../api/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const sp = new URLSearchParams(loc.search);
  const next = sp.get('redirect') || (loc.state as any)?.from || "/";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await login(email, password);
      nav(next, { replace: true });
    } catch (e: any) {
      setErr(formatApiError(e, "Error de login"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="auth-title">Inicia sesión</h1>
      <p className="auth-subtitle">Gestiona propiedades, contratos e incidencias en un único lugar.</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-label" htmlFor="email">
          Correo electrónico
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            placeholder="correo@dominio.com"
            autoComplete="email"
          />
        </label>
        <label className="auth-label" htmlFor="password">
          Contraseña
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>
        {err && <p className="auth-error" style={{ color: '#b91c1c' }}>{err}</p>}
        <div className="flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="auth-link text-indigo-700 hover:underline">Recuperar contraseña</Link>
          <Link to="/register" className="auth-link text-gray-600 hover:underline">Crear cuenta</Link>
        </div>
        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <div className="auth-footer">
        ¿No tienes cuenta? <Link to="/register" className="auth-link">Regístrate</Link>
      </div>
    </>
  );
}
