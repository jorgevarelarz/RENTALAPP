import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { formatApiError } from "../../api/client";
import {
  passwordPolicyError,
  PASSWORD_MIN_LENGTH,
  resetPassword as apiResetPassword,
} from "../../services/auth";

export default function ResetPassword() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("El enlace no es válido. Pide uno nuevo desde «¿La has olvidado?».");
      return;
    }
    const policyError = passwordPolicyError(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiResetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(formatApiError(err, "No se pudo restablecer la contraseña"));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <>
        <h1 className="auth-title">Contraseña actualizada</h1>
        <p className="auth-subtitle">Ya puedes entrar con tu contraseña nueva.</p>
        <Link to="/login" className="auth-button w-full justify-center">Iniciar sesión</Link>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-title">Restablecer contraseña</h1>
      <p className="auth-subtitle">Crea una contraseña nueva para recuperar el acceso.</p>
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="auth-label" htmlFor="password">
          Nueva contraseña
          <input
            id="password"
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(event) => { setPassword(event.target.value); if (error) setError(""); }}
            className="auth-input"
            placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
            autoComplete="new-password"
            disabled={loading}
          />
        </label>
        {error && (
          <div className="auth-alert" role="alert">
            <AlertCircle size={17} className="auth-alert-icon" />
            <span>{error}</span>
          </div>
        )}
        <button type="submit" className="auth-button" disabled={loading}>
          {loading && <span className="auth-spinner" aria-hidden="true" />}
          {loading ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </form>
      <div className="auth-footer">
        <Link to="/login" className="auth-link">Volver a iniciar sesión</Link>
      </div>
    </>
  );
}
