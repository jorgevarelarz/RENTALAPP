import React, { useState } from "react";
import { Link } from "react-router-dom";
import { formatApiError } from "../../api/client";
import { requestPasswordReset } from "../../services/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await requestPasswordReset(email.trim());
      setMessage("Si el email existe, recibirás un enlace para restablecer tu contraseña.");
    } catch (err: any) {
      setError(formatApiError(err, "No se pudo solicitar el enlace"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="auth-title">Recuperar contraseña</h1>
      <p className="auth-subtitle">Te enviaremos un enlace para crear una contraseña nueva.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-label" htmlFor="email">
          Correo electrónico
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="auth-input"
            placeholder="correo@dominio.com"
            autoComplete="email"
          />
        </label>
        {message && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>
      <div className="auth-footer">
        <Link to="/login" className="auth-link text-indigo-700 hover:underline">Volver al login</Link>
      </div>
    </>
  );
}
