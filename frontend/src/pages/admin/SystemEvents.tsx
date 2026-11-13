import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, RefreshCw } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Button, { buttonClassName } from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorCard from '../../components/ui/ErrorCard';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/ui/PageHeader';
import Select from '../../components/ui/Select';
import { formatApiError } from '../../api/client';
import {
  exportSystemEventsCsv,
  fetchSystemEvents,
  type SystemEventItem,
  type SystemEventsResponse,
} from '../../api/systemEvents';
import { blobErrorBody, saveBlob } from '../../utils/download';
import type { StatusTone } from '../../utils/statusBadges';

// Tipos que escribe hoy el backend (complianceValidation, adminRateLimit, property.controller, retención)
const EVENT_TYPES: Record<string, { label: string; tone: StatusTone }> = {
  COMPLIANCE_RISK_CREATED: { label: 'Renta en riesgo', tone: 'warning' },
  LISTING_PRICE_LIMIT_EXCEEDED: { label: 'Precio por encima del límite', tone: 'warning' },
  ADMIN_RATE_LIMIT_HIT: { label: 'Límite de peticiones', tone: 'danger' },
  SYSTEM_EVENTS_RETENTION_RUN: { label: 'Limpieza de eventos', tone: 'neutral' },
};

const RESOURCES: Record<string, string> = {
  contract: 'Contrato',
  property: 'Inmueble',
  admin: 'Administración',
  system: 'Sistema',
};

const ERRORS: Record<string, string> = {
  invalid_date_range: 'Revisa las fechas: «Desde» tiene que ser anterior a «Hasta».',
};

const PAGE_SIZE = 25;
const COLUMNS = ['Evento', 'Recurso', 'Fecha'];

const emptyResponse: SystemEventsResponse = { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };

const dateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const eventType = (type: string) => EVENT_TYPES[type] || { label: type, tone: 'neutral' as StatusTone };

const requestIdOf = (item: SystemEventItem) => {
  const id = (item.payload as any)?.requestId;
  return typeof id === 'string' && id ? id : null;
};

// Contratos e inmuebles tienen ficha; el resto se enseña tal cual
function ResourceCell({ item }: { item: SystemEventItem }) {
  const label = item.resourceType ? RESOURCES[item.resourceType] || item.resourceType : '—';
  const id = item.resourceId;
  const href =
    id && item.resourceType === 'contract' ? `/contracts/${id}` : id && item.resourceType === 'property' ? `/properties/${id}` : null;
  return (
    <>
      <div>{label}</div>
      {id && (
        <div className="max-w-[12rem] truncate font-mono text-xs text-[var(--ra-muted)]" title={id}>
          {href ? (
            <Link to={href} className="underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
              {id}
            </Link>
          ) : (
            id
          )}
        </div>
      )}
    </>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Sin permiso de portapapeles no hay nada que hacer: el ID está a la vista
        }
      }}
    >
      {copied ? 'Copiado' : 'Copiar'}
    </Button>
  );
}

export default function SystemEvents() {
  const [data, setData] = useState<SystemEventsResponse>(emptyResponse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SystemEventItem | null>(null);

  const filters = {
    type: typeFilter || undefined,
    resourceType: resourceType || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSystemEvents({
        page,
        pageSize: PAGE_SIZE,
        type: typeFilter || undefined,
        resourceType: resourceType || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setData(response || emptyResponse);
    } catch (err: any) {
      setError(ERRORS[err?.response?.data?.error] || formatApiError(err, 'No se pudieron cargar los eventos.'));
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, resourceType, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, resourceType, dateFrom, dateTo]);

  const total = data.total || 0;
  const rows = data.items || [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const hasFilters = Boolean(typeFilter || resourceType || dateFrom || dateTo);

  const clearFilters = () => {
    setTypeFilter('');
    setResourceType('');
    setDateFrom('');
    setDateTo('');
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      saveBlob(await exportSystemEventsCsv(filters), 'eventos-del-sistema.csv');
    } catch (err: any) {
      const body = await blobErrorBody(err);
      setExportError(ERRORS[body?.error || ''] || body?.message || formatApiError(err, 'No se pudo exportar el CSV.'));
    } finally {
      setExporting(false);
    }
  };

  const selectedRequestId = selected ? requestIdOf(selected) : null;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Eventos del sistema"
        subtitle="Avisos automáticos: rentas en riesgo, precios por encima del límite y peticiones bloqueadas."
        cta={
          <Link to="/admin/compliance" className={buttonClassName('secondary', 'sm', 'whitespace-nowrap')}>
            Cumplimiento
          </Link>
        }
      />

      <Card className="p-4">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            fetchData();
          }}
        >
          <Select label="Evento" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(EVENT_TYPES).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select label="Recurso" value={resourceType} onChange={(e) => setResourceType(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(RESOURCES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input label="Desde" type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
          <Input label="Hasta" type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" variant="secondary" disabled={loading}>
              <RefreshCw size={16} aria-hidden="true" />
              Actualizar
            </Button>
            <Button type="button" variant="secondary" onClick={handleExport} disabled={exporting}>
              <Download size={16} aria-hidden="true" />
              {exporting ? 'Exportando…' : 'CSV'}
            </Button>
          </div>
        </form>
        {exportError && <p role="alert" className="ra-field-error mt-3">{exportError}</p>}
      </Card>

      {error && <ErrorCard message={error} onRetry={fetchData} />}

      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title={hasFilters ? 'Ningún evento coincide con los filtros' : 'Todavía no hay eventos'}
          detail={hasFilters ? undefined : 'Aquí aparecerán los avisos que genera la plataforma por sí sola.'}
          cta={hasFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Quitar filtros</Button> : undefined}
        />
      )}

      {(loading || rows.length > 0) && !error && (
        <Card className="overflow-hidden">
          {/* relative: el <th> sr-only es absoluto y, sin esto, ensancha la página en móvil */}
          <div className="relative overflow-x-auto">
            <table className="min-w-full text-sm" aria-busy={loading}>
              <thead className="border-b border-[var(--ra-line)] bg-[var(--ra-paper)] text-left text-[13px] font-semibold text-[var(--ra-muted)]">
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col} scope="col" className="whitespace-nowrap px-4 py-3">
                      {col}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ra-line)]">
                {loading
                  ? Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx}>
                        {[...COLUMNS, ''].map((col) => (
                          <td key={col} className="px-4 py-4">
                            <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-[var(--ra-paper)]" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : rows.map((item) => {
                      const kind = eventType(item.type);
                      return (
                        <tr key={item._id} className="align-top">
                          <td className="px-4 py-3">
                            <Badge tone={kind.tone}>{kind.label}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <ResourceCell item={item} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-[var(--ra-muted)]">{dateTime(item.createdAt)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            <Button variant="secondary" size="sm" onClick={() => setSelected(item)}>
                              Ver detalle
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          {!loading && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ra-line)] px-4 py-3 text-sm text-[var(--ra-muted)]">
              <span className="tabular-nums">
                {rangeStart}–{rangeEnd} de {total.toLocaleString('es-ES')}
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

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? eventType(selected.type).label : undefined}>
        {selected && (
          <div className="space-y-4 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-[var(--ra-muted)]">Tipo</dt>
              <dd className="font-mono text-xs leading-5">{selected.type}</dd>
              <dt className="text-[var(--ra-muted)]">Recurso</dt>
              <dd>
                <ResourceCell item={selected} />
              </dd>
              <dt className="text-[var(--ra-muted)]">Fecha</dt>
              <dd>{dateTime(selected.createdAt)}</dd>
              {selectedRequestId && (
                <>
                  <dt className="text-[var(--ra-muted)]">ID de petición</dt>
                  <dd className="flex items-center gap-2">
                    <span className="break-all font-mono text-xs">{selectedRequestId}</span>
                    <CopyButton value={selectedRequestId} />
                  </dd>
                </>
              )}
            </dl>
            <div>
              <p className="mb-1 text-[13px] font-semibold text-[var(--ra-muted)]">Datos del evento</p>
              <pre className="max-h-80 overflow-auto rounded-xl border border-[var(--ra-line)] bg-[var(--ra-paper)] p-3 font-mono text-xs leading-5">
                {JSON.stringify(selected.payload || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
