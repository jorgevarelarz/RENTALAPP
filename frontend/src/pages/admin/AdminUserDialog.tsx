import React, { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import ErrorCard from '../../components/ui/ErrorCard';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { api, formatApiError } from '../../api/client';

export type AdminUser = {
  id: string;
  name?: string;
  email: string;
  role: string;
  isVerified?: boolean;
  companyName?: string;
  createdAt?: string;
};

// Los roles que PATCH /api/users/:id deja asignar (ASSIGNABLE_ROLES en user.controller.ts)
const ASSIGNABLE: Record<string, string> = {
  tenant: 'Inquilino',
  landlord: 'Propietario',
  pro: 'Profesional',
  agency: 'Agencia',
};

const ERRORS: Record<string, string> = {
  invalid_name: 'El nombre no puede quedar vacío ni pasar de 120 caracteres.',
  invalid_email: 'Ese correo no es válido.',
  email_already_exists: 'Ya hay otra cuenta con ese correo.',
  invalid_role: 'Ese rol no se puede asignar.',
  role_locked: 'El rol de las cuentas de administración e institución no se cambia desde aquí.',
  invalid_companyName: 'El nombre de la empresa no puede pasar de 200 caracteres.',
  invalid_user_id: 'Esta cuenta ya no existe.',
  invalid_payload: 'Revisa los datos de la cuenta.',
};

type Props = {
  user: AdminUser | null;
  roleLabel: (role: string) => string;
  onClose: () => void;
  onSaved: (user: AdminUser) => void;
};

const formFrom = (u: AdminUser | null) => ({
  name: u?.name || '',
  email: u?.email || '',
  companyName: u?.companyName || '',
  role: u?.role || '',
  isVerified: Boolean(u?.isVerified),
});

export default function AdminUserDialog({ user, roleLabel, onClose, onSaved }: Props) {
  const [form, setForm] = useState(formFrom(user));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(formFrom(user));
    setError(null);
  }, [user]);

  if (!user) return null;
  const roleLocked = !(user.role in ASSIGNABLE);

  // Solo se envía lo que ha cambiado: así un correo con otras mayúsculas o un rol bloqueado no se tocan
  const changes = () => {
    const body: Record<string, unknown> = {};
    if (form.name.trim() !== (user.name || '')) body.name = form.name.trim();
    if (form.email.trim().toLowerCase() !== user.email.toLowerCase()) body.email = form.email.trim();
    if (form.companyName.trim() !== (user.companyName || '')) body.companyName = form.companyName.trim();
    if (!roleLocked && form.role !== user.role) body.role = form.role;
    if (form.isVerified !== Boolean(user.isVerified)) body.isVerified = form.isVerified;
    return body;
  };
  const dirty = Object.keys(changes()).length > 0;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = changes();
    if (!Object.keys(body).length) return onClose();
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.patch(`/api/users/${user.id}`, body);
      onSaved({ ...user, ...data, id: data?.id || user.id });
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.error;
      setError(ERRORS[code] || (status === 404 ? ERRORS.invalid_user_id : formatApiError(err, 'No se pudo guardar la cuenta.')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={() => !saving && onClose()} title={user.name || user.email}>
      <form className="space-y-4" onSubmit={save}>
        <p className="text-sm text-[var(--ra-muted)]">
          {user.createdAt
            ? `Alta el ${new Date(user.createdAt).toLocaleDateString('es-ES', { dateStyle: 'long' })}.`
            : 'Sin fecha de alta.'}{' '}
          Los cambios de rol e identidad se aplican en la siguiente petición de la cuenta.
        </p>
        <Input
          label="Nombre"
          required={Boolean(user.name)}
          maxLength={120}
          autoComplete="off"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Correo"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label="Empresa (opcional)"
          maxLength={200}
          value={form.companyName}
          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
        />
        {roleLocked ? (
          <div className="ra-field">
            <span className="ra-field-label">Rol</span>
            <p className="text-sm">
              {roleLabel(user.role)}
              <span className="block text-[var(--ra-muted)]">Las cuentas de administración e institución no cambian de rol.</span>
            </p>
          </div>
        ) : (
          <Select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {Object.entries(ASSIGNABLE).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
        <label className="flex items-start gap-3 rounded-lg border border-[var(--ra-line)] p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--ra-navy)]"
            checked={form.isVerified}
            onChange={(e) => setForm({ ...form, isVerified: e.target.checked })}
          />
          <span>
            <span className="block font-medium">Identidad verificada</span>
            <span className="text-[var(--ra-muted)]">Normalmente se marca sola al completar la verificación. Cámbiala a mano solo si has comprobado el documento.</span>
          </span>
        </label>
        {error && <ErrorCard message={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
