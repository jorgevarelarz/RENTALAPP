import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, TrendingUp, Users, FileSignature } from 'lucide-react';
import { getEarningsSummary, listEarnings, downloadInvoice, type AgencyEarningsSummary } from '../../services/agency';

const eur = (cents: number) => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

export default function AgencyHome() {
  const [summary, setSummary] = useState<AgencyEarningsSummary | null>(null);
  const [movs, setMovs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, m] = await Promise.all([getEarningsSummary(), listEarnings()]);
        setSummary(s);
        setMovs(m.items || []);
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="py-4 text-sm text-gray-500">Cargando…</p>;

  const s = summary;
  return (
    <div className="py-2 grid gap-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-950">Tu agencia</h2>
          <p className="mt-0.5 text-sm text-gray-500">Comisiones recurrentes por los contratos que operan en RentalApp.</p>
        </div>
        <button
          onClick={() => downloadInvoice()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Download size={15} /> Autofactura del mes
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Comisiones este mes</p>
          <p className="mt-1 text-3xl font-bold text-gray-950">{eur(s?.monthCents || 0)}</p>
          <p className="mt-1 text-xs text-gray-400">{s?.monthOperations || 0} operaciones</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Contratos activos</p>
          <p className="mt-1 text-3xl font-bold text-gray-950">{s?.activeContracts ?? 0}</p>
          <p className="mt-1 text-xs text-gray-400">captados o gestionados por ti</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-5">
          <p className="text-sm text-indigo-700 font-medium inline-flex items-center gap-1.5"><TrendingUp size={14} /> Tu tramo actual</p>
          <p className="mt-1 text-3xl font-bold text-indigo-700">{s?.currentPct ?? 0}%</p>
          {s?.nextTier ? (
            <p className="mt-1 text-xs text-indigo-600">
              Te faltan <strong>{s.nextTier.missing}</strong> contratos activos para pasar al <strong>{s.nextTier.pct}%</strong>
            </p>
          ) : (
            <p className="mt-1 text-xs text-indigo-600">{s?.tiers?.length ? 'Estás en el tramo máximo' : 'Porcentaje fijo vigente'}</p>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link to="/agency/landlords" className="group rounded-xl border border-gray-200 bg-white p-5 hover:border-indigo-300 transition-colors">
          <Users size={20} className="text-indigo-600" />
          <p className="mt-2 font-semibold text-gray-950 group-hover:text-indigo-600">Dar de alta propietario</p>
          <p className="mt-0.5 text-sm text-gray-500">Cada propietario activo suma contratos que te pagan todos los meses.</p>
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <FileSignature size={20} className="text-gray-400" />
          <p className="mt-2 font-semibold text-gray-950">Movimientos del mes</p>
          {movs.length === 0 ? (
            <p className="mt-0.5 text-sm text-gray-500">Sin comisiones todavía este mes.</p>
          ) : (
            <ul className="mt-2 grid gap-1.5 text-sm text-gray-600">
              {movs.slice(0, 5).map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span className="truncate text-gray-500">{new Date(m.createdAt).toLocaleDateString('es-ES')} · {m.sharePct}%</span>
                  <span className="font-semibold text-gray-950">{eur(m.partnerShareCents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!!s?.history?.length && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="font-semibold text-gray-950 mb-3">Histórico mensual</p>
          <div className="grid gap-1.5">
            {s.history.map((h) => {
              const max = Math.max(...s.history.map((x) => x.cents), 1);
              return (
                <div key={h.month} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-gray-500 tabular-nums">{h.month}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.max(4, (h.cents / max) * 100)}%` }} />
                  </div>
                  <span className="w-24 text-right font-medium text-gray-900 tabular-nums">{eur(h.cents)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
