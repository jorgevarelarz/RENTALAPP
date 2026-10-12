import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DownloadCloud } from 'lucide-react';
import { api as axios } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Button from '../components/ui/Button';
import { formatEuros } from '../utils/tickets';

type EarningsStats = {
  totalEarnings?: number;
  monthEarnings?: number;
  totalTransactions?: number;
  chart?: { label: string; amount: number }[];
};

const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' });

/** El backend etiqueta los meses como «10/2026»; aquí se muestran como «oct 2026». */
export function monthLabel(label: string) {
  const [m, y] = String(label).split('/').map(Number);
  if (!m || !y) return label;
  return monthFormatter.format(new Date(y, m - 1, 1)).replace('.', '');
}

/** Los seis últimos meses, con 0 € en los que no hubo cobros (el backend solo devuelve los que tienen). */
export function lastSixMonths(chart: { label: string; amount: number }[], now = new Date()) {
  const byLabel = new Map(chart.map((d) => [d.label, d.amount]));
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const label = `${d.getMonth() + 1}/${d.getFullYear()}`;
    return { label, amount: byLabel.get(label) || 0 };
  });
}

export default function Earnings() {
  const { token } = useAuth();
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<EarningsStats | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadEarnings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await axios.get('/api/contracts/earnings/stats', { headers: { Authorization: `Bearer ${token}` } });
      setData(res.data);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadEarnings(); }, [loadEarnings]);

  const handleExport = async () => {
    if (!token) return;
    try {
      setExporting(true);
      const response = await axios.get('/api/contracts/earnings/export', {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reporte-RentalApp-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      push({ title: 'No se ha podido generar el informe. Inténtalo de nuevo.', tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <p className="p-8 text-center text-[var(--ra-muted)]" role="status">Cargando ingresos…</p>;

  const chart = lastSixMonths(data?.chart || []);
  const hasPayments = chart.some((d) => d.amount > 0);
  const maxVal = Math.max(...chart.map((d) => d.amount), 1);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-['Manrope'] text-3xl font-bold tracking-tight text-[var(--ra-ink)]">Ingresos</h1>
          <p className="mt-1 text-[var(--ra-muted)]">Rentas y fianzas cobradas con RentalApp.</p>
        </div>
        <Button variant="secondary" onClick={handleExport} disabled={exporting || failed} className="self-start md:self-auto">
          <DownloadCloud size={18} aria-hidden="true" />
          {exporting ? 'Generando…' : 'Descargar CSV'}
        </Button>
      </div>

      {failed ? (
        <div className="rounded-2xl border border-[var(--ra-line)] bg-white p-6" role="alert">
          <p className="font-semibold text-[var(--ra-ink)]">No se han podido cargar tus ingresos.</p>
          <p className="mt-1 text-sm text-[var(--ra-muted)]">Comprueba la conexión y vuelve a intentarlo.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={loadEarnings}>Reintentar</Button>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: 'Total cobrado', value: formatEuros(data?.totalEarnings || 0) },
              { label: 'Este mes', value: formatEuros(data?.monthEarnings || 0) },
              { label: 'Cobros', value: String(data?.totalTransactions || 0) },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-[var(--ra-line)] bg-white p-5">
                <dt className="text-sm font-medium text-[var(--ra-muted)]">{s.label}</dt>
                <dd className="mt-2 font-['Manrope'] text-3xl font-bold tabular-nums tracking-tight text-[var(--ra-ink)]">{s.value}</dd>
              </div>
            ))}
          </dl>

          <section className="rounded-2xl border border-[var(--ra-line)] bg-white p-5 sm:p-6" aria-labelledby="earnings-chart-title">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="earnings-chart-title" className="font-['Manrope'] text-lg font-bold text-[var(--ra-ink)]">Últimos 6 meses</h2>
              <Link to="/landlord/payments" className="text-sm font-semibold text-[var(--ra-blue)] hover:underline">
                Ver cobros y recibos
              </Link>
            </div>
            {!hasPayments ? (
              <p className="py-12 text-center text-sm text-[var(--ra-muted)]">
                Cuando tus inquilinos paguen la renta o la fianza con RentalApp, los cobros aparecerán aquí.
              </p>
            ) : (
              <ul className="mt-6 flex h-60 gap-2 sm:gap-4">
                {chart.map((item) => (
                  <li key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <span aria-hidden="true" className="hidden text-xs font-semibold tabular-nums text-[var(--ra-ink)] sm:block">{item.amount ? formatEuros(item.amount) : ''}</span>
                    <div className="flex w-full flex-1 items-end justify-center border-b border-[var(--ra-line)]">
                      {item.amount > 0 && (
                        <span
                          className="block w-full max-w-[56px] rounded-t-lg bg-[var(--ra-blue)]"
                          style={{ height: `${Math.max(2, Math.round((item.amount / maxVal) * 100))}%` }}
                          title={formatEuros(item.amount)}
                        />
                      )}
                    </div>
                    <span className="text-center text-xs text-[var(--ra-muted)]">
                      {monthLabel(item.label)}
                      <span className="sr-only">: {formatEuros(item.amount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
