import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, RefreshCw } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Button, { buttonClassName } from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorCard from '../../components/ui/ErrorCard';
import Input from '../../components/ui/Input';
import PageHeader from '../../components/ui/PageHeader';
import Select from '../../components/ui/Select';
import { formatApiError } from '../../api/client';
import { appEnv } from '../../config/env';
import type { StatusTone } from '../../utils/statusBadges';
import {
  fetchComplianceDashboard,
  exportComplianceDashboardCsv,
  type ComplianceDashboardData,
  type ComplianceDashboardItem,
} from '../../api/adminCompliance';

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  compliant: { label: 'Cumple', tone: 'success' },
  risk: { label: 'En riesgo', tone: 'warning' },
  non_compliant: { label: 'Incumple', tone: 'danger' },
};

const SEVERITY: Record<string, { label: string; tone: StatusTone }> = {
  info: { label: 'Informativa', tone: 'neutral' },
  warning: { label: 'Aviso', tone: 'warning' },
  critical: { label: 'Crítica', tone: 'danger' },
};

const ERRORS: Record<string, string> = {
  invalid_date_range: 'Revisa las fechas: «Desde» tiene que ser anterior a «Hasta».',
};

const PAGE_SIZE = 25;
const COLUMNS = ['Inmueble', 'Zona', 'Renta', 'Estado', 'Gravedad', 'Revisado'];

const emptyDashboard: ComplianceDashboardData = {
  totals: { evaluated: 0, risk: 0 },
  byArea: [],
  items: [],
  page: 1,
  pageSize: PAGE_SIZE,
  total: 0,
};

const isDemoMode = appEnv.rentalPublicDemoMode.toLowerCase() === 'true';

const eur = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
        maximumFractionDigits: 2,
      })
    : '—';

const dateTime = (value?: string | Date | null) =>
  value ? new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

// «galicia|oleiros|centro» → «galicia · oleiros · centro»
const areaLabel = (key?: string) => (key ? key.split('|').filter(Boolean).join(' · ') || key : '—');

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

// El CSV llega como Blob: si falla, el JSON del error viene dentro del Blob
async function exportErrorMessage(err: any) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await readBlob(data));
      return ERRORS[parsed?.error] || parsed?.message || 'No se pudo exportar el CSV.';
    } catch {
      return 'No se pudo exportar el CSV.';
    }
  }
  return ERRORS[data?.error] || formatApiError(err, 'No se pudo exportar el CSV.');
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-[var(--ra-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function RentChange({ item }: { item: ComplianceDashboardItem }) {
  const diff = typeof item.previousRent === 'number' && typeof item.newRent === 'number' && item.previousRent > 0
    ? ((item.newRent - item.previousRent) / item.previousRent) * 100
    : null;
  return (
    <>
      <div className="whitespace-nowrap tabular-nums">
        {eur(item.previousRent)} → {eur(item.newRent)}
      </div>
      {diff !== null && diff !== 0 && (
        <div className="text-xs text-[var(--ra-muted)] tabular-nums">
          {diff > 0 ? '+' : ''}
          {diff.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %
        </div>
      )}
    </>
  );
}

export default function ComplianceDashboard() {
  const [data, setData] = useState<ComplianceDashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [areaKey, setAreaKey] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  // Las zonas del desplegable salen de la primera carga sin filtro de zona, para no perderlas al filtrar
  const [areas, setAreas] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashboard = await fetchComplianceDashboard({
        page,
        pageSize: PAGE_SIZE,
        status: statusFilter || undefined,
        areaKey: areaKey || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      const next = dashboard || emptyDashboard;
      setData(next);
      if (!areaKey) {
        setAreas((prev) => Array.from(new Set([...prev, ...(next.byArea || []).map((a) => a.areaKey)])).filter(Boolean));
      }
    } catch (err: any) {
      setError(ERRORS[err?.response?.data?.error] || formatApiError(err, 'No se pudo cargar el panel de cumplimiento.'));
    } finally {
      setLoading(false);
    }
  }, [areaKey, dateFrom, dateTo, page, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, areaKey, dateFrom, dateTo]);

  const totals = data.totals || { evaluated: 0, risk: 0 };
  const totalRows = data.total ?? totals.evaluated ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const rangeStart = totalRows === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalRows);
  const hasFilters = Boolean(statusFilter || areaKey || dateFrom || dateTo);
  const fmt = (n?: number) => (typeof n === 'number' ? n.toLocaleString('es-ES') : '—');

  const clearFilters = () => {
    setStatusFilter('');
    setAreaKey('');
    setDateFrom('');
    setDateTo('');
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await exportComplianceDashboardCsv({
        status: statusFilter || undefined,
        areaKey: areaKey || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cumplimiento-rentas.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(await exportErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Cumplimiento de rentas"
        subtitle="Subidas de renta revisadas frente a la ley de vivienda y las zonas tensionadas."
        cta={
          <div className="flex flex-wrap gap-2">
            {[
              ['/admin/compliance/tensioned-areas', 'Zonas tensionadas'],
              ['/admin/compliance/audit-trails', 'Pistas de firma'],
              ['/admin/compliance/policies', 'Políticas'],
            ].map(([to, label]) => (
              <Link key={to} to={to} className={buttonClassName('secondary', 'sm', 'whitespace-nowrap')}>
                {label}
              </Link>
            ))}
          </div>
        }
      />

      {isDemoMode && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--ra-muted)]">
          <Badge tone="info">Datos de ejemplo</Badge>
          RENTAL_PUBLIC_DEMO_MODE está activo: las cifras no salen de la base.
        </p>
      )}

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Contratos revisados" value={fmt(totals.evaluated)} />
        <StatCard label="Cumplen" value={fmt(totals.compliant)} />
        <StatCard label="En riesgo" value={fmt(totals.risk)} />
        <StatCard label="Incumplen" value={fmt(totals.nonCompliant)} />
      </section>

      <Card className="p-4">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            fetchData();
          }}
        >
          <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="compliant">Cumple</option>
            <option value="risk">En riesgo</option>
            <option value="non_compliant">Incumple</option>
          </Select>
          <Select label="Zona" value={areaKey} onChange={(e) => setAreaKey(e.target.value)}>
            <option value="">Todas</option>
            {areas.map((key) => (
              <option key={key} value={key}>
                {areaLabel(key)}
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

      {!loading && !error && data.items.length === 0 && (
        <EmptyState
          title={hasFilters ? 'Ningún contrato coincide con los filtros' : 'Todavía no hay contratos revisados'}
          detail={
            hasFilters
              ? undefined
              : 'Cada subida de renta en un contrato se revisa sola y aparece aquí con su estado.'
          }
          cta={hasFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Quitar filtros</Button> : undefined}
        />
      )}

      {(loading || data.items.length > 0) && !error && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm" aria-busy={loading}>
              <thead className="border-b border-[var(--ra-line)] bg-[var(--ra-paper)] text-left text-[13px] font-semibold text-[var(--ra-muted)]">
                <tr>
                  {COLUMNS.map((col) => (
                    <th key={col} scope="col" className="whitespace-nowrap px-4 py-3">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ra-line)]">
                {loading
                  ? Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx}>
                        {COLUMNS.map((col) => (
                          <td key={col} className="px-4 py-4">
                            <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-[var(--ra-paper)]" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : data.items.map((item) => {
                      const status = STATUS[item.status] || { label: item.status || '—', tone: 'neutral' as StatusTone };
                      const severity = SEVERITY[item.severity] || { label: item.severity || '—', tone: 'neutral' as StatusTone };
                      const place = [item.propertyCity, item.propertyRegion].filter(Boolean).join(', ');
                      return (
                        <tr key={`${item.contractId}-${item.propertyId}`} className="align-top">
                          <td className="px-4 py-3">
                            <div className="font-medium">{item.propertyAddress || 'Inmueble sin dirección'}</div>
                            {item.contractId && (
                              <Link
                                to={`/contracts/${item.contractId}`}
                                className="text-xs text-[var(--ra-muted)] underline-offset-2 hover:underline"
                              >
                                Contrato …{item.contractId.slice(-6)}
                              </Link>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="capitalize">{areaLabel(item.areaKey)}</div>
                            {place && <div className="text-xs capitalize text-[var(--ra-muted)]">{place}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <RentChange item={item} />
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={status.tone}>{status.label}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={severity.tone}>{severity.label}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-[var(--ra-muted)]">{dateTime(item.checkedAt)}</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
          {!loading && totalRows > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ra-line)] px-4 py-3 text-sm text-[var(--ra-muted)]">
              <span className="tabular-nums">
                {rangeStart}–{rangeEnd} de {fmt(totalRows)} · última revisión {dateTime(data.lastUpdated)}
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
    </div>
  );
}
