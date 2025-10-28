import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register as apiRegister } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"tenant"|"landlord"|"pro">("tenant");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const { login } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      await apiRegister(name.trim(), email.trim(), password, role);
      await login(email.trim(), password);
      nav("/", { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="auth-title">Crea tu cuenta</h1>
      <p className="auth-subtitle">Elige tu rol para personalizar la experiencia.</p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-label" htmlFor="name">
          Nombre
          <input id="name" required className="auth-input" value={name} onChange={e=>setName(e.target.value)} />
        </label>
        <label className="auth-label" htmlFor="email">
          Correo electrónico
          <input id="email" type="email" required className="auth-input" value={email} onChange={e=>setEmail(e.target.value)} />
        </label>
        <label className="auth-label" htmlFor="password">
          Contraseña
          <input id="password" type="password" required className="auth-input" value={password} onChange={e=>setPassword(e.target.value)} />
        </label>
        <fieldset style={{ display: 'grid', gap: 8 }}>
          <legend className="auth-label" style={{ fontWeight: 600 }}>Rol</legend>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="role" value="tenant" checked={role==='tenant'} onChange={()=>setRole('tenant')} /> Inquilino
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="role" value="landlord" checked={role==='landlord'} onChange={()=>setRole('landlord')} /> Propietario
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="radio" name="role" value="pro" checked={role==='pro'} onChange={()=>setRole('pro')} /> Profesional (PRO)
          </label>
        </fieldset>
        {err && <p className="auth-error" style={{ color: '#b91c1c' }}>{err}</p>}
        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
      <div className="auth-footer">
        ¿Ya tienes cuenta? <Link to="/login" className="auth-link">Inicia sesión</Link>
      </div>
    </>
  );
}
