import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatApiError } from "../../api/client";
import { resetPassword as apiResetPassword } from "../../services/auth";

export default function ResetPassword() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setError("Token no válido. Revisa el enlace de recuperación.");
      return;
    }
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await apiResetPassword(token, password);
      setMessage("Contraseña actualizada. Ya puedes iniciar sesión.");
    } catch (err: any) {
      setError(formatApiError(err, "No se pudo restablecer la contraseña"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="auth-title">Restablecer contraseña</h1>
      <p className="auth-subtitle">Crea una contraseña nueva para recuperar el acceso.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-label" htmlFor="password">
          Nueva contraseña
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="auth-input"
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
        </label>
        {message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
      <div className="auth-footer">
        <Link to="/login" className="auth-link text-indigo-700 hover:underline">Volver al login</Link>
      </div>
    </>
  );
}
