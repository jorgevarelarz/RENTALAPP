import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { passwordPolicyError } from '../../services/auth';

// Códigos de POST /api/auth/change-password (auth.controller.ts).
const CHANGE_ERRORS: Record<string, string> = {
  wrong_password: 'La contraseña actual no es correcta.',
  same_password: 'La contraseña nueva tiene que ser distinta de la actual.',
  too_many_requests: 'Demasiados intentos. Espera 15 minutos.',
};

const EMPTY = { current: '', next: '', repeat: '' };

/** Cambio de contraseña con la sesión iniciada; cierra las sesiones de los demás dispositivos. */
export default function ChangePasswordCard() {
  const { changePassword } = useAuth();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [noPassword, setNoPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const close = () => {
    setOpen(false);
    setValues(EMPTY);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const policy = passwordPolicyError(values.next);
    if (policy) return setError(policy);
    if (values.next !== values.repeat) return setError('Las dos contraseñas nuevas no coinciden.');
    setSaving(true);
    setError(null);
    try {
      await changePassword(values.current, values.next);
      close();
      push({ title: 'Contraseña cambiada. Hemos cerrado la sesión en tus otros dispositivos.', tone: 'success' });
    } catch (err: any) {
      const code = err?.response?.data?.error;
      if (code === 'password_not_set') {
        setNoPassword(true);
        close();
      } else {
        setError(CHANGE_ERRORS[code] || 'No se pudo cambiar la contraseña. Inténtalo de nuevo.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="font-semibold text-gray-900">Contraseña</h3>
      {noPassword ? (
        <p className="mt-2 text-sm text-gray-600">
          Entras con Google o Apple y tu cuenta no tiene contraseña.{' '}
          <Link to="/forgot-password" className="font-semibold text-[var(--ra-blue)] hover:underline">
            Elige una por correo
          </Link>
          .
        </p>
      ) : !open ? (
        <>
          <p className="mt-2 text-sm text-gray-600">Al cambiarla se cierra la sesión en tus otros dispositivos.</p>
          <Button variant="outline" className="mt-4 w-full text-sm" onClick={() => setOpen(true)}>
            Cambiar contraseña
          </Button>
        </>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
          <Input
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={values.current}
            onChange={set('current')}
            required
          />
          <Input
            label="Contraseña nueva"
            type="password"
            autoComplete="new-password"
            value={values.next}
            onChange={set('next')}
            required
          />
          <Input
            label="Repite la contraseña nueva"
            type="password"
            autoComplete="new-password"
            value={values.repeat}
            onChange={set('repeat')}
            required
          />
          <p className="text-xs text-gray-500">Mínimo 8 caracteres.</p>
          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <Button type="submit" className="flex-1 text-sm" disabled={saving || !values.current || !values.next}>
              {saving ? 'Guardando…' : 'Guardar contraseña'}
            </Button>
            <Button type="button" variant="ghost" className="text-sm" onClick={close} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
