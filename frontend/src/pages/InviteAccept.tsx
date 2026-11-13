import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getInvite, acceptInvite } from '../services/agency';
import { setStoredUser } from '../services/auth';
import { formatApiError } from '../api/client';

const ACCEPT_ERRORS: Record<string, string> = {
  user_already_exists: 'Ya hay una cuenta con este correo. Entra con ella o recupera la contraseña.',
  invite_already_accepted: 'Esta invitación ya se usó. Entra con tu correo y contraseña.',
  invite_expired: 'La invitación ha caducado. Pide a tu inmobiliaria que te envíe una nueva.',
  invite_not_found: 'La invitación ya no es válida. Pide a tu inmobiliaria que te envíe una nueva.',
  invalid_payload: 'La contraseña debe tener al menos 8 caracteres.',
};
const LOGIN_CODES = new Set(['user_already_exists', 'invite_already_accepted']);

export default function InviteAccept() {
  const { token = '' } = useParams();
  const nav = useNavigate();
  const [invite, setInvite] = useState<Awaited<ReturnType<typeof getInvite>> | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
    getInvite(token)
      .then(setInvite)
      .catch((e: any) => {
        // Solo un 404 significa que el enlace no vale; lo demás (red, 500) se puede reintentar
        if (e?.response?.status === 404) setNotFound(true);
        else setLoadFailed(true);
      });
  }, [token, reload]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await acceptInvite(token, { password });
      setStoredUser({ ...(res.user as any), token: res.token });
      window.location.href = '/';
    } catch (e: any) {
      const code = e?.response?.data?.error || '';
      setErr({ code, message: ACCEPT_ERRORS[code] || formatApiError(e, 'No se pudo activar la cuenta') });
      setLoading(false);
    }
  };

  if (notFound) {
    return (
      <>
        <h1 className="auth-title">Invitación no válida</h1>
        <p className="auth-subtitle">El enlace no existe o ha sido retirado. Pide a tu inmobiliaria que te envíe uno nuevo.</p>
      </>
    );
  }
  if (loadFailed) {
    return (
      <>
        <h1 className="auth-title">No se pudo cargar la invitación</h1>
        <p className="auth-subtitle">Comprueba tu conexión e inténtalo de nuevo. El enlace sigue valiendo.</p>
        <button className="auth-button" onClick={() => setReload((n) => n + 1)}>Reintentar</button>
      </>
    );
  }
  if (!invite) return <p className="auth-subtitle">Cargando…</p>;

  if (invite.status === 'accepted') {
    return (
      <>
        <h1 className="auth-title">Esta invitación ya se usó</h1>
        <p className="auth-subtitle">Tu cuenta ya está activa. Entra con tu email y contraseña.</p>
        <button className="auth-button" onClick={() => nav('/login')}>Ir a iniciar sesión</button>
      </>
    );
  }
  if (invite.status === 'expired') {
    return (
      <>
        <h1 className="auth-title">Invitación caducada</h1>
        <p className="auth-subtitle">Pide a {invite.agencyName} que te envíe una invitación nueva.</p>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-title">Activa tu cuenta</h1>
      <p className="auth-subtitle">
        <strong>{invite.agencyName}</strong> ha preparado tu cuenta para gestionar tu alquiler
        {invite.propertyAddress ? <> de <strong>{invite.propertyAddress}</strong></> : null}: contrato, firma digital, cobros y recibos en un solo sitio.
      </p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <label className="auth-label">
          Correo electrónico
          <input className="auth-input" value={invite.landlordEmail} disabled />
        </label>
        <label className="auth-label" htmlFor="password">
          Crea tu contraseña
          <span className="auth-input-wrap">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (err) setErr(null); }}
              className="auth-input"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              disabled={loading}
            />
            <button type="button" className="auth-eye" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        {err && (
          <div className="auth-alert" role="alert">
            <AlertCircle size={17} className="auth-alert-icon" />
            <span>
              {err.message}
              {LOGIN_CODES.has(err.code) && <> <Link to="/login">Iniciar sesión</Link></>}
            </span>
          </div>
        )}
        <button type="submit" className="auth-button" disabled={loading || password.length < 8}>
          {loading && <span className="auth-spinner" aria-hidden="true" />}
          {loading ? 'Activando…' : 'Activar mi cuenta'}
        </button>
      </form>
      <div className="auth-footer">
        Al activar tu cuenta aceptas los términos y la política de privacidad de RentalApp.
      </div>
    </>
  );
}
