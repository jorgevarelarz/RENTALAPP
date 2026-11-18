import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { acceptCoTenantInvite, getCoTenantInvitePreview, CoTenantInvitePreview } from '../services/coTenants';

const ACCEPT_ERRORS: Record<string, string> = {
  email_mismatch: 'La invitación es para otro correo. Entra con la cuenta del correo invitado.',
  invite_expired: 'La invitación ha caducado. Pide al inquilino principal que te invite de nuevo.',
  invite_not_found: 'La invitación ya no es válida: puede que ya se haya usado o que la hayan retirado.',
};

/** Invitación de co-titular de un contrato: /invites/accept?token=… (enlace del email). */
export default function CoTenantInviteAccept() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const nav = useNavigate();
  const { user, logout } = useAuth();
  const [invite, setInvite] = useState<CoTenantInvitePreview | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [err, setErr] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      return;
    }
    setLoadFailed(false);
    getCoTenantInvitePreview(token)
      .then(setInvite)
      .catch((e: any) => {
        // Solo un 404 significa que el enlace no vale; lo demás (red, 500) se puede reintentar
        if (e?.response?.status === 404) setNotFound(true);
        else setLoadFailed(true);
      });
  }, [token, reload]);

  const here = `/invites/accept?token=${encodeURIComponent(token)}`;
  const loginHref = `/login?redirect=${encodeURIComponent(here)}`;

  const accept = async () => {
    setErr(null);
    setAccepting(true);
    try {
      const { contractId } = await acceptCoTenantInvite(token);
      nav(`/contracts/${contractId}`, { replace: true });
    } catch (e: any) {
      const code = e?.response?.data?.error || '';
      setErr({
        code,
        message:
          code === 'owner_not_verified'
            ? 'Antes de unirte al contrato tienes que verificar tu identidad.'
            : ACCEPT_ERRORS[code] || 'No se pudo aceptar la invitación. Inténtalo de nuevo.',
      });
      setAccepting(false);
    }
  };

  if (notFound) {
    return (
      <>
        <h1 className="auth-title">Invitación no válida</h1>
        <p className="auth-subtitle">
          El enlace no existe o ya se ha usado. Si ya aceptaste la invitación, encontrarás el contrato en tu cuenta.
        </p>
        <Link className="auth-button" to={user ? '/contracts' : '/login'}>
          {user ? 'Ir a mis contratos' : 'Iniciar sesión'}
        </Link>
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

  if (invite.expired) {
    return (
      <>
        <h1 className="auth-title">Invitación caducada</h1>
        <p className="auth-subtitle">
          Las invitaciones valen 48 horas. Pide a {invite.inviterName || 'quien te invitó'} que te invite de nuevo desde el contrato.
        </p>
      </>
    );
  }

  const property = invite.property;
  const place = [property?.address, property?.city].filter(Boolean).join(', ');
  const sameEmail = !!user && user.email?.trim().toLowerCase() === invite.email;

  return (
    <>
      <h1 className="auth-title">Únete al contrato como co-titular</h1>
      <p className="auth-subtitle">
        {invite.inviterName ? <strong>{invite.inviterName}</strong> : 'El inquilino principal'} te ha invitado a compartir
        el contrato de alquiler. Como co-titular podrás verlo y firmarlo con tu cuenta.
      </p>

      <dl className="auth-invite-summary">
        {property?.title && (
          <div>
            <dt>Vivienda</dt>
            <dd>{property.title}</dd>
          </div>
        )}
        {place && (
          <div>
            <dt>Dirección</dt>
            <dd>{place}</dd>
          </div>
        )}
        <div>
          <dt>Invitación para</dt>
          <dd>{invite.email}</dd>
        </div>
      </dl>

      {err && (
        <div className="auth-alert" role="alert">
          <AlertCircle size={17} className="auth-alert-icon" />
          <span>
            {err.message}
            {err.code === 'owner_not_verified' && (
              <>
                {' '}
                <Link className="auth-link" to="/tenant/kyc">Verificar identidad</Link>
              </>
            )}
          </span>
        </div>
      )}

      {!user && (
        <div className="auth-form">
          <p className="auth-hint">Para aceptarla, entra o crea tu cuenta con {invite.email}.</p>
          <Link className="auth-button" to={loginHref}>Iniciar sesión</Link>
          <Link
            className="auth-button auth-button-secondary"
            to={`/register?role=tenant&email=${encodeURIComponent(invite.email)}&redirect=${encodeURIComponent(here)}`}
          >
            Crear cuenta
          </Link>
        </div>
      )}

      {user && !sameEmail && (
        <div className="auth-form">
          <p className="auth-hint">
            Has entrado como {user.email}. Cierra la sesión y entra con {invite.email} para aceptar.
          </p>
          <button
            type="button"
            className="auth-button"
            onClick={() => {
              logout();
              nav(loginHref);
            }}
          >
            Cambiar de cuenta
          </button>
        </div>
      )}

      {user && sameEmail && (
        <div className="auth-form">
          <button type="button" className="auth-button" onClick={accept} disabled={accepting}>
            {accepting && <span className="auth-spinner" aria-hidden="true" />}
            {accepting ? 'Aceptando…' : 'Aceptar invitación'}
          </button>
        </div>
      )}
    </>
  );
}
