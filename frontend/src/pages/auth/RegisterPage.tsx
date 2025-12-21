import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { register as apiRegister } from "../../services/auth";
import { useAuth } from "../../context/AuthContext";

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const paramRole = searchParams.get("role");
  const validRoles = ["tenant", "landlord", "pro"];
  const initialRole = validRoles.includes(paramRole || "")
    ? (paramRole as "tenant" | "landlord" | "pro")
    : "tenant";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"tenant"|"landlord"|"pro">(initialRole);
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
      const path = role === 'tenant' ? '/tenant'
        : role === 'landlord' ? '/landlord'
        : role === 'pro' ? '/pro'
        : '/properties';

      nav(path, { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="auth-title">Crea tu cuenta</h1>
      <p className="auth-subtitle">
        {role === 'tenant' && "Encuentra tu próximo hogar de forma segura."}
        {role === 'landlord' && "Gestiona tus propiedades con total tranquilidad."}
        {role === 'pro' && "Únete a nuestra red de profesionales certificados."}
      </p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-label" htmlFor="name">
          Nombre completo
          <input
            id="name"
            required
            className="auth-input"
            value={name}
            onChange={e=>setName(e.target.value)}
            placeholder="Ej. Juan Pérez"
          />
        </label>
        <label className="auth-label" htmlFor="email">
          Correo electrónico
          <input
            id="email"
            type="email"
            required
            className="auth-input"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            placeholder="nombre@ejemplo.com"
          />
        </label>
        <label className="auth-label" htmlFor="password">
          Contraseña
          <input
            id="password"
            type="password"
            required
            className="auth-input"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </label>
        <fieldset className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
          <legend className="text-sm font-semibold text-gray-700 px-1">Selecciona tu perfil</legend>
          <div className="flex flex-col gap-3 mt-2">
            <label className={`flex items-center gap-3 p-3 rounded-md cursor-pointer border transition-all ${role === 'tenant' ? 'bg-blue-50 border-blue-200 shadow-sm' : 'border-transparent hover:bg-gray-100'}`}>
              <input type="radio" name="role" value="tenant" checked={role==='tenant'} onChange={()=>setRole('tenant')} className="text-blue-600 focus:ring-blue-500" />
              <div>
                <span className="block font-medium text-gray-900">Inquilino</span>
                <span className="block text-xs text-gray-500">Busco alquilar una propiedad</span>
              </div>
            </label>

            <label className={`flex items-center gap-3 p-3 rounded-md cursor-pointer border transition-all ${role === 'landlord' ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'border-transparent hover:bg-gray-100'}`}>
              <input type="radio" name="role" value="landlord" checked={role==='landlord'} onChange={()=>setRole('landlord')} className="text-emerald-600 focus:ring-emerald-500" />
              <div>
                <span className="block font-medium text-gray-900">Propietario</span>
                <span className="block text-xs text-gray-500">Quiero alquilar y gestionar mis inmuebles</span>
              </div>
            </label>

            <label className={`flex items-center gap-3 p-3 rounded-md cursor-pointer border transition-all ${role === 'pro' ? 'bg-orange-50 border-orange-200 shadow-sm' : 'border-transparent hover:bg-gray-100'}`}>
              <input type="radio" name="role" value="pro" checked={role==='pro'} onChange={()=>setRole('pro')} className="text-orange-600 focus:ring-orange-500" />
              <div>
                <span className="block font-medium text-gray-900">Profesional</span>
                <span className="block text-xs text-gray-500">Ofrezco servicios de mantenimiento</span>
              </div>
            </label>
          </div>
        </fieldset>

        {err && <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-100">{err}</div>}

        <button type="submit" className="auth-button mt-6 w-full justify-center" disabled={loading}>
          {loading ? 'Creando cuenta…' : 'Crear cuenta gratis'}
        </button>
      </form>

      <div className="auth-footer mt-6 text-center">
        ¿Ya tienes cuenta? <Link to="/login" className="auth-link font-medium text-blue-600 hover:text-blue-500">Inicia sesión</Link>
      </div>
    </>
  );
}
