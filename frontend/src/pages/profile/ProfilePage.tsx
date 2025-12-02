import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ProBadge from '../../components/ProBadge';
import { useToast } from '../../context/ToastContext';
import { updateUserProfile } from '../../services/users';
import { requestPasswordReset } from '../../services/auth';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { push } = useToast();
  const isTenantPro = user?.role === 'tenant' && user?.tenantPro?.status === 'verified';

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
  }, [user?.name, user?.email]);

  if (!user) return <div>Inicia sesión para ver tu perfil.</div>;

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await updateUserProfile(user._id, { name, email });
      updateUser({ name: updated.name, email: updated.email });
      push({ title: 'Perfil actualizado', tone: 'success' });
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudieron guardar los cambios';
      push({ title: msg, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      setSendingReset(true);
      await requestPasswordReset(user.email);
      push({ title: 'Te enviamos un enlace para cambiar la contraseña', tone: 'success' });
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || 'No se pudo enviar el correo';
      push({ title: msg, tone: 'error' });
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 560 }}>
      <h2>Perfil y cuenta</h2>

      <div style={{ display: 'grid', gap: 8, padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600 }}>Nombre</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tu nombre"
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontWeight: 600 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tucorreo@example.com"
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
          />
        </div>
        <div style={{ color: '#6b7280' }}>Rol: <strong>{user.role}</strong></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #111827', background: '#111827', color: 'white' }}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <button
            onClick={() => { setName(user.name || ''); setEmail(user.email); }}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'white' }}
          >
            Deshacer
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ fontWeight: 600 }}>Seguridad</div>
        <p style={{ margin: 0, color: '#374151' }}>Recibe un enlace por email para cambiar tu contraseña.</p>
        <button
          onClick={handlePasswordReset}
          disabled={sendingReset}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #111827', background: '#111827', color: 'white', width: 'fit-content' }}
        >
          {sendingReset ? 'Enviando…' : 'Enviar enlace de cambio'}
        </button>
      </div>

      {isTenantPro && (
        <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
          <ProBadge maxRent={user?.tenantPro?.maxRent} />
          <p style={{ marginTop: 8, color: '#374151' }}>Tu verificación PRO está activa.</p>
        </div>
      )}
    </div>
  );
}
