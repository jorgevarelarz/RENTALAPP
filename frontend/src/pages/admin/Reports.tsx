import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Download, FileCheck2, Receipt, Users } from 'lucide-react';
import api, { formatApiError } from '../../api/client';
import { earningsSummary } from '../../services/admin';
import { useAuth } from '../../context/AuthContext';

function defaultFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const eur = (value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

export default function AdminReports() {
  const { token, user } = useAuth();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const [stats, setStats] = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, earningsRes] = await Promise.all([
        api.get('/api/admin/stats'),
        token && user?._id ? earningsSummary(token, user._id, { from, to, groupBy: 'day' }) : Promise.resolve(null),
      ]);
      setStats(statsRes.data || {});
      setEarnings(earningsRes);
    } catch (err) {
      setError(formatApiError(err, 'No se pudieron cargar los reportes'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?._id]);

  const activationRate = useMemo(() => {
    const total = Number(stats?.contracts?.total || 0);
    const active = Number(stats?.contracts?.active || 0) + Number(stats?.contracts?.completed || 0);
    return total ? Math.round((active / total) * 100) : 0;
  }, [stats]);

  const exportCsv = () => {
    const rows = [
      ['metric', 'value'],
      ['users_total', stats?.users?.total || 0],
      ['users_tenants', stats?.users?.tenants || 0],
      ['users_landlords', stats?.users?.landlords || 0],
      ['properties_total', stats?.properties || 0],
      ['contracts_total', stats?.contracts?.total || 0],
      ['contracts_active', stats?.contracts?.active || 0],
      ['contracts_completed', stats?.contracts?.completed || 0],
      ['earnings_gross', earnings?.totals?.gross || 0],
      ['earnings_fee', earnings?.totals?.fee || 0],
      ['earnings_net', earnings?.totals?.net || 0],
    ];
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rentalapp_admin_report_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Reportes admin</p>
          <h1 className="text-2xl font-bold text-gray-950">Resumen ejecutivo</h1>
          <p className="mt-1 text-sm text-gray-600">Uso de plataforma, contratos y finanzas del periodo seleccionado.</p>
        </div>
        <button onClick={exportCsv} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          <Download size={16} /> Exportar resumen
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm font-medium text-gray-700">Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-gray-700">Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2" />
        </label>
        <button onClick={load} disabled={loading} className="self-end rounded-md border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric icon={<Users size={18} />} label="Usuarios" value={loading ? '...' : stats?.users?.total || 0} detail={`${stats?.users?.tenants || 0} tenants · ${stats?.users?.landlords || 0} propietarios`} />
        <Metric icon={<BarChart3 size={18} />} label="Propiedades" value={loading ? '...' : stats?.properties || 0} detail="Inventario total" />
        <Metric icon={<FileCheck2 size={18} />} label="Contratos" value={loading ? '...' : stats?.contracts?.total || 0} detail={`${activationRate}% activos/completados`} />
        <Metric icon={<Receipt size={18} />} label="Comisión" value={loading ? '...' : eur(Number(earnings?.totals?.fee || 0))} detail={`Bruto ${eur(Number(earnings?.totals?.gross || 0))}`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-950">Contratos por estado</h2>
          <div className="mt-4 grid gap-3">
            {[
              ['Borrador', stats?.contracts?.draft || 0],
              ['Activo', stats?.contracts?.active || 0],
              ['Completado', stats?.contracts?.completed || 0],
              ['Cancelado', stats?.contracts?.cancelled || 0],
            ].map(([label, value]) => (
              <Progress key={String(label)} label={String(label)} value={Number(value)} max={Math.max(Number(stats?.contracts?.total || 0), 1)} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-950">Reportes especializados</h2>
          <div className="mt-4 grid gap-2">
            <ReportLink to="/admin/payments" title="Finanzas y comisiones" detail="Movimientos, earnings y CSV completo." />
            <ReportLink to="/admin/compliance" title="Compliance" detail="Riesgos, zonas tensionadas y export legal." />
            <ReportLink to="/admin/compliance/audit-trails" title="Auditoría de contratos" detail="Evidencias, PDFs y trazabilidad." />
            <ReportLink to="/admin/system-events" title="System events" detail="Errores técnicos y requestId." />
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-gray-500">{icon}<span className="text-sm">{label}</span></div>
      <div className="mt-2 text-2xl font-bold text-gray-950">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{detail}</div>
    </div>
  );
}

function Progress({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm"><span className="text-gray-600">{label}</span><span className="font-medium text-gray-950">{value}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function ReportLink({ to, title, detail }: { to: string; title: string; detail: string }) {
  return (
    <Link to={to} className="rounded-lg border border-gray-200 p-3 hover:border-indigo-300 hover:bg-indigo-50/30">
      <span className="block font-medium text-gray-950">{title}</span>
      <span className="mt-0.5 block text-sm text-gray-500">{detail}</span>
    </Link>
  );
}
