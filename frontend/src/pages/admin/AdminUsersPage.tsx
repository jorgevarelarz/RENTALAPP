import React, { useCallback, useEffect, useState } from 'react';
import { Download, Plus, RefreshCw } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorCard from '../../components/ui/ErrorCard';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/ui/PageHeader';
import Select from '../../components/ui/Select';
import { api, formatApiError } from '../../api/client';
import { blobErrorBody, saveBlob } from '../../utils/download';
import type { StatusTone } from '../../utils/statusBadges';

type AdminUser = {
  id: string;
  name?: string;
  email: string;
  role: string;
  isVerified?: boolean;
  companyName?: string;
  createdAt?: string;
};

// Los roles del modelo (user.model.ts)
const ROLES: Record<string, { label: string; tone: StatusTone }> = {
  tenant: { label: 'Inquilino', tone: 'neutral' },
  landlord: { label: 'Propietario', tone: 'neutral' },
  agency: { label: 'Agencia', tone: 'info' },
  pro: { label: 'Profesional', tone: 'info' },
  admin: { label: 'Administrador', tone: 'warning' },
  institution_viewer: { label: 'Institución', tone: 'neutral' },
};

const ERRORS: Record<string, string> = {
  invalid_role: 'Ese rol no existe.',
  email_already_exists: 'Ya hay una cuenta con ese correo.',
  invalid_payload: 'Revisa los datos: nombre, correo y una contraseña de al menos 8 caracteres.',
};

const PAGE_SIZE = 25;
const COLUMNS = ['Usuario', 'Rol', 'Identidad', 'Alta'];
// En móvil solo queda la columna «Usuario»: rol, identidad y alta van debajo del nombre
const colClass = (idx: number) => (idx === 0 ? '' : 'hidden md:table-cell');
const EMPTY_AGENCY = { name: '', email: '', password: '', companyName: '' };

const date = (value?: string) => (value ? new Date(value).toLocaleDateString('es-ES', { dateStyle: 'medium' }) : '—');

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [agencyOpen, setAgencyOpen] = useState(false);
  const [agencyForm, setAgencyForm] = useState(EMPTY_AGENCY);
  const [agencyError, setAgencyError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Se busca al dejar de teclear, y siempre desde la primera página
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useCallback(() => {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (role) params.role = role;
    return params;
  }, [q, role]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/api/users', { params: { ...filters(), page, limit: PAGE_SIZE } });
      setItems(data?.items || []);
      setTotal(data?.total ?? 0);
    } catch (err: any) {
      setError(ERRORS[err?.response?.data?.error] || formatApiError(err, 'No se pudieron cargar los usuarios.'));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // El CSV lo genera el servidor con todas las cuentas del filtro, no solo la página visible
  const exportCSV = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await api.get('/api/users/export.csv', { params: filters(), responseType: 'blob' });
      saveBlob(res.data, 'usuarios.csv');
    } catch (err: any) {
      const body = await blobErrorBody(err);
      setExportError(ERRORS[body?.error || ''] || body?.message || formatApiError(err, 'No se pudo exportar el CSV.'));
    } finally {
      setExporting(false);
    }
  };

  const createAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    setAgencyError(null);
    setCreating(true);
    try {
      const { data } = await api.post('/api/users', {
        name: agencyForm.name.trim(),
        email: agencyForm.email.trim(),
        password: agencyForm.password,
        companyName: agencyForm.companyName.trim() || undefined,
        role: 'agency',
      });
      setAgencyOpen(false);
      setAgencyForm(EMPTY_AGENCY);
      setNotice(`Agencia creada: ${data?.user?.email || agencyForm.email.trim()}. Comparte la contraseña temporal por un canal seguro.`);
      setSearch('');
      setQ('');
      setRole('agency');
      setPage(1);
    } catch (err: any) {
      setAgencyError(ERRORS[err?.response?.data?.error] || formatApiError(err, 'No se pudo crear la agencia.'));
    } finally {
      setCreating(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setQ('');
    setRole('');
    setPage(1);
  };

  const filtered = Boolean(q || role);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Usuarios"
        subtitle="Todas las cuentas de la plataforma, de la más reciente a la más antigua."
        cta={
          <Button size="sm" onClick={() => setAgencyOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Nueva agencia
          </Button>
        }
      />

      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-lg border border-[var(--ra-line)] bg-[var(--ra-paper)] p-4 text-sm">
          <span>{notice}</span>
          <button type="button" className="whitespace-nowrap font-semibold underline" onClick={() => setNotice(null)}>
            Cerrar
          </button>
        </div>
      )}

      <Card className="p-4">
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            fetchUsers();
          }}
        >
          <Input
            label="Buscar"
            type="search"
            placeholder="Nombre, correo o empresa"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Rol"
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {Object.entries(ROLES).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <div className="flex gap-2 sm:justify-end">
            <Button type="submit" variant="secondary" disabled={loading}>
              <RefreshCw size={16} aria-hidden="true" />
              Actualizar
            </Button>
            <Button type="button" variant="secondary" onClick={exportCSV} disabled={total === 0 || exporting}>
              <Download size={16} aria-hidden="true" />
              CSV
            </Button>
          </div>
        </form>
      </Card>

      {error && <ErrorCard message={error} onRetry={fetchUsers} />}
      {exportError && <ErrorCard message={exportError} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title={filtered ? 'Ninguna cuenta coincide con la búsqueda' : 'Todavía no hay cuentas'}
          detail={filtered ? 'Prueba con otro nombre o correo, o con otro rol.' : undefined}
          cta={
            filtered ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                Quitar filtros
              </Button>
            ) : undefined
          }
        />
      )}

      {(loading || items.length > 0) && !error && (
        <Card className="overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="min-w-full text-sm" aria-busy={loading}>
              <thead className="border-b border-[var(--ra-line)] bg-[var(--ra-paper)] text-left text-[13px] font-semibold text-[var(--ra-muted)]">
                <tr>
                  {COLUMNS.map((col, idx) => (
                    <th key={col} scope="col" className={`whitespace-nowrap px-4 py-3 ${colClass(idx)}`}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ra-line)]">
                {loading
                  ? Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx}>
                        {COLUMNS.map((col, idx) => (
                          <td key={col} className={`px-4 py-4 ${colClass(idx)}`}>
                            <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-[var(--ra-paper)]" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : items.map((u) => {
                      const r = ROLES[u.role];
                      const roleBadge = <Badge tone={r?.tone || 'neutral'}>{r?.label || u.role}</Badge>;
                      const identity = u.isVerified ? (
                        <Badge tone="success">Verificada</Badge>
                      ) : (
                        <span className="text-[var(--ra-muted)]">Sin verificar</span>
                      );
                      return (
                        <tr key={u.id} className="align-top">
                          <td className="px-4 py-3">
                            <div className="font-medium">{u.name || 'Sin nombre'}</div>
                            <div className="text-[var(--ra-muted)] [overflow-wrap:anywhere]">{u.email}</div>
                            {u.companyName && <div className="text-xs text-[var(--ra-muted)]">{u.companyName}</div>}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs md:hidden">
                              {roleBadge}
                              {identity}
                              <span className="text-[var(--ra-muted)]">Alta: {date(u.createdAt)}</span>
                            </div>
                          </td>
                          <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">{roleBadge}</td>
                          <td className="hidden whitespace-nowrap px-4 py-3 md:table-cell">{identity}</td>
                          <td className="hidden whitespace-nowrap px-4 py-3 text-[var(--ra-muted)] md:table-cell">{date(u.createdAt)}</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          {!loading && items.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ra-line)] px-4 py-3 text-sm text-[var(--ra-muted)]">
              <span className="tabular-nums">
                {totalPages > 1
                  ? `${rangeStart}–${rangeEnd} de ${total.toLocaleString('es-ES')} cuentas`
                  : `${total.toLocaleString('es-ES')} ${total === 1 ? 'cuenta' : 'cuentas'}`}
              </span>
              {totalPages > 1 && (
                <nav aria-label="Paginación" className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    Anterior
                  </Button>
                  <span className="tabular-nums">
                    Página {page} de {totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Siguiente
                  </Button>
                </nav>
              )}
            </div>
          )}
        </Card>
      )}

      <Modal open={agencyOpen} onClose={() => !creating && setAgencyOpen(false)} title="Nueva agencia">
        <form className="space-y-4" onSubmit={createAgency}>
          <p className="text-sm text-[var(--ra-muted)]">
            La cuenta queda verificada. La agencia entra con este correo y la contraseña temporal, y puede cambiarla con «¿La has olvidado?» en el acceso.
          </p>
          <Input
            label="Persona de contacto"
            required
            minLength={2}
            autoComplete="off"
            value={agencyForm.name}
            onChange={(e) => setAgencyForm({ ...agencyForm, name: e.target.value })}
          />
          <Input
            label="Correo de la agencia"
            type="email"
            required
            autoComplete="off"
            value={agencyForm.email}
            onChange={(e) => setAgencyForm({ ...agencyForm, email: e.target.value })}
          />
          <Input
            label="Empresa (opcional)"
            value={agencyForm.companyName}
            onChange={(e) => setAgencyForm({ ...agencyForm, companyName: e.target.value })}
          />
          <Input
            label="Contraseña temporal"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={agencyForm.password}
            onChange={(e) => setAgencyForm({ ...agencyForm, password: e.target.value })}
          />
          {agencyError && <ErrorCard message={agencyError} />}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAgencyOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Creando…' : 'Crear agencia'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
