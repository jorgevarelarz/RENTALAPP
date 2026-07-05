import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { formatApiError } from "../../api/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
            autoFocus
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (err) setErr(null); }}
            className="auth-input"
            placeholder="correo@dominio.com"
            autoComplete="email"
            disabled={loading}
          />
        </label>
        <label className="auth-label" htmlFor="password">
          <span className="auth-label-row">
            Contraseña
            <Link to="/forgot-password" className="auth-link-muted" tabIndex={-1}>
              ¿La has olvidado?
            </Link>
          </span>
          <span className="auth-input-wrap">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (err) setErr(null); }}
              className="auth-input"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
            />
            <button
              type="button"
              className="auth-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        {err && (
          <div className="auth-alert" role="alert">
            <AlertCircle size={17} className="auth-alert-icon" />
            <span>{err}</span>
          </div>
        )}
        <button type="submit" className="auth-button" disabled={loading}>
          {loading && <span className="auth-spinner" aria-hidden="true" />}
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <div className="auth-footer">
        ¿No tienes cuenta? <Link to="/register" className="auth-link">Crea una gratis</Link>
      </div>
    </>
  );
}
