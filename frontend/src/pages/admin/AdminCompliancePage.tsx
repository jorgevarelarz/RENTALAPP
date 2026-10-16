import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, RefreshCw } from 'lucide-react';
import Badge from '../../components/ui/Badge';
import Button, { buttonClassName } from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorCard from '../../components/ui/ErrorCard';
import PageHeader from '../../components/ui/PageHeader';
import Select from '../../components/ui/Select';
import { api as axios, formatApiError } from '../../api/client';
import { csvRows } from '../../utils/csv';
import { saveBlob } from '../../utils/download';

type Acceptance = {
  user: { id: string; email: string };
  policyType: string;
  policyVersion: string;
  acceptedAt: string;
  ip?: string;
  userAgent?: string;
};

// Los cuatro tipos del modelo (userPolicyAcceptance.model.ts)
const POLICY_LABELS: Record<string, string> = {
  terms_of_service: 'Términos y condiciones',
  privacy_policy: 'Privacidad',
  cookies_policy: 'Cookies',
  data_processing: 'Tratamiento de datos',
};

const COLUMNS = ['Usuario', 'Política', 'Aceptada', 'IP', 'Navegador'];

const dateTime = (value?: string) =>
  value ? new Date(value).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function AdminCompliancePage() {
  const [data, setData] = useState<Acceptance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policyType, setPolicyType] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | boolean> = {};
      if (policyType) params.policyType = policyType;
      if (activeOnly) params.activeOnly = true;
      const res = await axios.get('/api/admin/policies/acceptances', { params });
      setData(res.data?.data || []);
    } catch (err: any) {
      setError(formatApiError(err, 'No se pudieron cargar las aceptaciones.'));
    } finally {
      setLoading(false);
    }
  }, [policyType, activeOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportCSV = () => {
    const header = ['userId', 'email', 'policyType', 'policyVersion', 'acceptedAt', 'ip', 'userAgent'];
    const rows = data.map((d) => [d.user.id, d.user.email, d.policyType, d.policyVersion, d.acceptedAt, d.ip || '', d.userAgent || '']);
    saveBlob(new Blob([csvRows([header, ...rows])], { type: 'text/csv;charset=utf-8;' }), 'aceptaciones-politicas.csv');
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Aceptación de políticas"
        subtitle="Quién aceptó cada versión de los términos, la privacidad y el tratamiento de datos, y cuándo."
        cta={
          <div className="flex flex-wrap gap-2">
            {[
              ['/admin/compliance', 'Cumplimiento'],
              ['/admin/compliance/audit-trails', 'Pistas de firma'],
            ].map(([to, label]) => (
              <Link key={to} to={to} className={buttonClassName('secondary', 'sm', 'whitespace-nowrap')}>
                {label}
              </Link>
            ))}
          </div>
        }
      />

      <Card className="p-4">
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_auto_1fr] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            fetchData();
          }}
        >
          <Select label="Política" value={policyType} onChange={(e) => setPolicyType(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(POLICY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <label className="flex min-h-[44px] items-center gap-2 text-sm">
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            Solo versiones vigentes
          </label>
          <div className="flex gap-2 sm:justify-end">
            <Button type="submit" variant="secondary" disabled={loading}>
              <RefreshCw size={16} aria-hidden="true" />
              Actualizar
            </Button>
            <Button type="button" variant="secondary" onClick={exportCSV} disabled={data.length === 0}>
              <Download size={16} aria-hidden="true" />
              CSV
            </Button>
          </div>
        </form>
      </Card>

      {error && <ErrorCard message={error} onRetry={fetchData} />}

      {!loading && !error && data.length === 0 && (
        <EmptyState
          title={policyType ? 'Nadie ha aceptado esta política todavía' : 'Todavía no hay aceptaciones'}
          detail={
            activeOnly
              ? 'Solo se muestran las aceptaciones de la versión vigente de cada política.'
              : 'Cada usuario acepta las políticas al registrarse o cuando se publica una versión nueva.'
          }
          cta={
            activeOnly ? (
              <Button variant="secondary" size="sm" onClick={() => setActiveOnly(false)}>
                Ver también versiones anteriores
              </Button>
            ) : undefined
          }
        />
      )}

      {(loading || data.length > 0) && !error && (
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
                  : data.map((a, idx) => (
                      <tr key={`${a.user.id}-${a.policyType}-${a.policyVersion}-${idx}`} className="align-top">
                        <td className="px-4 py-3">
                          <div className="font-medium">{a.user.email || 'Cuenta borrada'}</div>
                          <div className="font-mono text-xs text-[var(--ra-muted)]">…{a.user.id.slice(-6)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{POLICY_LABELS[a.policyType] || a.policyType}</div>
                          <Badge tone="neutral">{a.policyVersion}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[var(--ra-muted)]">{dateTime(a.acceptedAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{a.ip || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="max-w-[18rem] truncate text-xs text-[var(--ra-muted)]" title={a.userAgent || undefined}>
                            {a.userAgent || '—'}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!loading && data.length > 0 && (
            <div className="border-t border-[var(--ra-line)] px-4 py-3 text-sm text-[var(--ra-muted)] tabular-nums">
              {data.length.toLocaleString('es-ES')} {data.length === 1 ? 'aceptación' : 'aceptaciones'}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
