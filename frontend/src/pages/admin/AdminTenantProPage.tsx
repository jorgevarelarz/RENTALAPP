import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileText, RefreshCw, Search } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorCard from '../../components/ui/ErrorCard';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/ui/PageHeader';
import { formatApiError } from '../../api/client';
import {
  decideTenantPro,
  fetchTenantProDoc,
  listPendingTenantPro,
  purgeTenantPro,
  type PendingTenantPro,
  type PendingTenantProDoc,
} from '../../services/tenantPro';
import { blobErrorBody, saveBlob } from '../../utils/download';

// Mismos nombres que ve el inquilino al subirlos (TenantProPanel)
const DOC_LABELS: Record<string, string> = {
  nomina: 'Nómina',
  contrato: 'Contrato de trabajo',
  renta: 'Declaración de la renta',
  autonomo: 'Ingresos de autónomo',
  otros: 'Otro documento',
};

const ERRORS: Record<string, string> = {
  invalid_max_rent: 'Indica la renta máxima validada (entre 1 y 100.000 €/mes) para aprobar.',
  invalid_decision: 'La decisión no es válida.',
  not_pending: 'Esta solicitud ya estaba resuelta. La lista se ha actualizado.',
  user_not_found: 'La cuenta ya no existe. La lista se ha actualizado.',
  doc_purged: 'Este documento ya se eliminó: se borran al cumplirse el plazo de conservación.',
  doc_not_found: 'El documento ya no está en la solicitud.',
};

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' };

const dateShort = (value?: string) =>
  value ? new Date(value).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const euros = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type Preview = { userId: string; doc: PendingTenantProDoc; owner: string; url?: string; blob?: Blob; error?: string };

export default function AdminTenantProPage() {
  const [pending, setPending] = useState<PendingTenantPro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [maxRentDraft, setMaxRentDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPending(await listPendingTenantPro());
    } catch (err: any) {
      setError(formatApiError(err, 'No se pudieron cargar las solicitudes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return pending;
    return pending.filter((u) => `${u.name || ''} ${u.email || ''}`.toLowerCase().includes(term));
  }, [pending, q]);

  const who = (u: PendingTenantPro) => u.name || u.email;

  const onDecision = async (user: PendingTenantPro, decision: 'approved' | 'rejected') => {
    const amount = Number(maxRentDraft[user._id] || 0);
    setRowError((prev) => ({ ...prev, [user._id]: '' }));
    if (decision === 'approved' && !(amount > 0)) {
      setRowError((prev) => ({ ...prev, [user._id]: ERRORS.invalid_max_rent }));
      return;
    }
    if (decision === 'rejected' && !window.confirm(`¿Rechazar la solicitud de ${who(user)}? Le llegará un aviso por correo.`)) return;
    setBusy(user._id);
    setMessage(null);
    try {
      await decideTenantPro(user._id, decision, decision === 'approved' ? amount : undefined);
      setMessage(
        decision === 'approved'
          ? `Solicitud de ${who(user)} aprobada con una renta máxima de ${euros(amount)}/mes.`
          : `Solicitud de ${who(user)} rechazada.`,
      );
      setMaxRentDraft((prev) => ({ ...prev, [user._id]: '' }));
      await load();
    } catch (err: any) {
      const code = err?.response?.data?.error;
      setRowError((prev) => ({ ...prev, [user._id]: ERRORS[code] || formatApiError(err, 'No se pudo guardar la decisión.') }));
      if (code === 'not_pending' || code === 'user_not_found') await load();
    } finally {
      setBusy(null);
    }
  };

  const onPurge = async (user: PendingTenantPro) => {
    if (!window.confirm(`¿Eliminar todos los documentos de ${who(user)}? La solicitud se cierra y no se puede deshacer.`)) return;
    setBusy(user._id);
    setMessage(null);
    try {
      await purgeTenantPro(user._id);
      setMessage(`Documentación de ${who(user)} eliminada.`);
      await load();
    } catch (err: any) {
      setRowError((prev) => ({ ...prev, [user._id]: formatApiError(err, 'No se pudo eliminar la documentación.') }));
    } finally {
      setBusy(null);
    }
  };

  const openDoc = async (user: PendingTenantPro, doc: PendingTenantProDoc) => {
    setPreview({ userId: user._id, doc, owner: who(user) });
    try {
      const blob = await fetchTenantProDoc(user._id, doc._id);
      setPreview((p) => (p && p.doc._id === doc._id ? { ...p, blob, url: URL.createObjectURL(blob) } : p));
    } catch (err: any) {
      const body = await blobErrorBody(err);
      const msg = ERRORS[body?.error || ''] || formatApiError(err, 'No se pudo abrir el documento.');
      setPreview((p) => (p && p.doc._id === doc._id ? { ...p, error: msg } : p));
    }
  };

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Revisión Tenant PRO"
        subtitle="Revisa los justificantes de solvencia de cada inquilino y fija la renta máxima que puede asumir."
        cta={
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" />
            Actualizar
          </Button>
        }
      />

      {(pending.length > 0 || q) && (
        <div className="max-w-sm">
          <div className="relative">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ra-muted)]" />
            <Input aria-label="Buscar por nombre o correo" type="search" placeholder="Buscar por nombre o correo" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>
      )}

      {message && (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}
      {error && <ErrorCard message={error} onRetry={load} />}

      {loading && pending.length === 0 && !error && (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <Card key={i} className="h-36 animate-pulse bg-[var(--ra-paper)]">
              <span className="sr-only">Cargando…</span>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={q ? 'Ninguna solicitud coincide' : 'No hay solicitudes pendientes'}
          detail={q ? undefined : 'Cuando un inquilino suba sus justificantes, la solicitud aparecerá aquí.'}
          cta={
            q ? (
              <Button variant="secondary" size="sm" onClick={() => setQ('')}>
                Quitar búsqueda
              </Button>
            ) : undefined
          }
        />
      )}

      {filtered.length > 0 && (
        <p className="text-sm text-[var(--ra-muted)]">
          {filtered.length === 1 ? '1 solicitud pendiente' : `${filtered.length} solicitudes pendientes`}
          {', de la más antigua a la más reciente.'}
        </p>
      )}

      <ul className="space-y-3">
        {filtered.map((user) => {
          const docs = user.tenantPro?.docs || [];
          const inputId = `max-rent-${user._id}`;
          const isBusy = busy === user._id;
          return (
            <li key={user._id}>
              <Card className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_17rem]">
                <div className="min-w-0 space-y-3">
                  <div>
                    <h2 className="truncate text-base font-semibold">{user.name || user.email}</h2>
                    <p className="flex flex-wrap gap-x-2 text-sm text-[var(--ra-muted)]">
                      {user.name && <span className="min-w-0 break-all">{user.email}</span>}
                      <span>Cuenta desde {dateShort(user.createdAt)}</span>
                      {!user.tenantPro?.consentAccepted && <span className="text-amber-700">Sin consentimiento aceptado</span>}
                    </p>
                  </div>
                  {docs.length === 0 ? (
                    <p className="text-sm text-[var(--ra-muted)]">No ha subido documentos.</p>
                  ) : (
                    <ul className="divide-y divide-[var(--ra-line)] rounded-lg border border-[var(--ra-line)]">
                      {docs.map((doc) => (
                        <li key={doc._id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                          <FileText size={16} aria-hidden="true" className="shrink-0 text-[var(--ra-muted)]" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{DOC_LABELS[doc.type] || doc.type}</div>
                            <div className="text-xs text-[var(--ra-muted)]">Subido el {dateShort(doc.uploadedAt)}</div>
                          </div>
                          {doc.available ? (
                            <Button variant="ghost" size="sm" onClick={() => openDoc(user, doc)}>
                              Abrir
                              <span className="sr-only"> {DOC_LABELS[doc.type] || doc.type} de {who(user)}</span>
                            </Button>
                          ) : (
                            <Badge tone="neutral">Eliminado</Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-3 md:border-l md:border-[var(--ra-line)] md:pl-5">
                  <div>
                    <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
                      Renta máxima validada
                    </label>
                    <div className="relative">
                      <Input
                        id={inputId}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={100000}
                        step={50}
                        value={maxRentDraft[user._id] ?? ''}
                        onChange={(e) => setMaxRentDraft((prev) => ({ ...prev, [user._id]: e.target.value }))}
                        className="pr-16 tabular-nums"
                        aria-describedby={`${inputId}-hint`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--ra-muted)]">
                        €/mes
                      </span>
                    </div>
                    <p id={`${inputId}-hint`} className="mt-1 text-xs text-[var(--ra-muted)]">
                      Los anuncios «solo Tenant PRO» la comparan con su renta.
                    </p>
                  </div>
                  {rowError[user._id] && (
                    <p role="alert" className="text-sm text-red-700">
                      {rowError[user._id]}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => onDecision(user, 'approved')} disabled={isBusy}>
                      Aprobar
                    </Button>
                    <Button variant="secondary" className="flex-1" onClick={() => onDecision(user, 'rejected')} disabled={isBusy}>
                      Rechazar
                    </Button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPurge(user)}
                    disabled={isBusy}
                    className="text-xs font-medium text-red-700 underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Eliminar documentación
                  </button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <Modal
        open={!!preview}
        onClose={closePreview}
        title={preview ? `${DOC_LABELS[preview.doc.type] || preview.doc.type} · ${preview.owner}` : undefined}
        className="max-w-4xl"
      >
        {preview && (
          <div className="space-y-3">
            {preview.error && <ErrorCard message={preview.error} />}
            {!preview.error && !preview.url && (
              <div className="h-[60vh] animate-pulse rounded-lg bg-[var(--ra-paper)]" aria-busy="true">
                <span className="sr-only">Abriendo el documento…</span>
              </div>
            )}
            {preview.url && preview.blob?.type.startsWith('image/') && (
              <img src={preview.url} alt={`${DOC_LABELS[preview.doc.type] || preview.doc.type} de ${preview.owner}`} className="mx-auto max-h-[70vh] rounded-lg border border-[var(--ra-line)]" />
            )}
            {preview.url && preview.blob?.type === 'application/pdf' && (
              <iframe title={`${DOC_LABELS[preview.doc.type] || preview.doc.type} de ${preview.owner}`} src={preview.url} className="h-[70vh] w-full rounded-lg border border-[var(--ra-line)]" />
            )}
            {preview.url && preview.blob && !preview.blob.type.startsWith('image/') && preview.blob.type !== 'application/pdf' && (
              <p className="text-sm text-[var(--ra-muted)]">Este formato no se puede previsualizar. Descárgalo para revisarlo.</p>
            )}
            {preview.blob && (
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => saveBlob(preview.blob!, `${preview.doc.type}-${preview.doc._id.slice(-6)}.${EXT[preview.blob!.type] || 'bin'}`)}
                >
                  <Download size={16} aria-hidden="true" />
                  Descargar
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
