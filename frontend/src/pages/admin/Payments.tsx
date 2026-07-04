import React, { useEffect, useState } from 'react';
import { Download, RefreshCcw } from 'lucide-react';
import { usePolicyAcceptance } from '../../hooks/usePolicyAcceptance';
import PolicyModal from '../../components/PolicyModal';
import { useAuth } from '../../context/AuthContext';
import { earningsExportCsv, earningsList, earningsSummary } from '../../services/admin';
import { formatApiError } from '../../api/client';

function defaultFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function eur(value: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

export default function AdminPayments() {
  const { token, user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState<any>(null);
  const [list, setList] = useState<any>({ items: [], total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { needsAcceptance, pendingPolicy, acceptPolicy } = usePolicyAcceptance(
    undefined,
    ['terms_of_service', 'data_processing'],
  );

  const loadData = async () => {
    if (!token || !user?._id) return;
    setLoading(true);
    setError('');
    try {
      const params = { from, to };
      const [summaryData, listData] = await Promise.all([
        earningsSummary(token, user._id, { ...params, groupBy: 'day' }),
        earningsList(token, user._id, { ...params, limit: 20 }),
      ]);
      setSummary(summaryData);
      setList(listData);
    } catch (err) {
      setError(formatApiError(err, 'No se pudo cargar el panel financiero'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?._id]);

  const handleAccept = async () => {
    await acceptPolicy();
    setShowModal(false);
  };

  const handleExport = async () => {
    if (!token || !user?._id) return;
    try {
      const blob = await earningsExportCsv(token, user._id, { from, to });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rentalapp-earnings-${from}-${to}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(formatApiError(err, 'No se pudo exportar CSV'));
    }
  };

  const totals = summary?.totals || { gross: 0, fee: 0, net: 0 };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Finanzas admin</p>
          <h1 className="text-2xl font-bold text-gray-900">Pagos y comisiones</h1>
          <p className="mt-1 text-sm text-gray-600">Auditoría de earnings, comisiones y neto liberado a profesionales.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCcw size={16} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {needsAcceptance && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Debes aceptar las políticas vigentes</strong>
          <p className="my-2">Falta aceptar: {pendingPolicy?.policyType ?? 'políticas obligatorias'}.</p>
          <div className="flex gap-2">
            <button className="rounded border border-amber-300 bg-white px-3 py-1.5" onClick={() => setShowModal(true)}>Ver políticas</button>
            <button className="rounded bg-amber-600 px-3 py-1.5 text-white" onClick={handleAccept}>Aceptar y continuar</button>
          </div>
        </div>
      )}

      <PolicyModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        policyTypes={['terms_of_service', 'data_processing']}
        pendingType={pendingPolicy?.policyType}
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm font-medium text-gray-700">
          Desde
          <input className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Hasta
          <input className="mt-1 block w-full rounded-md border border-gray-200 px-3 py-2" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button onClick={loadData} className="self-end rounded-md border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50">
          Filtrar
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Bruto procesado</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{eur(totals.gross)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Comisión RentalApp</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{eur(totals.fee)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Neto a profesionales</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{eur(totals.net)}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
          <h2 className="font-semibold text-gray-900">Movimientos recientes</h2>
          <p className="text-sm text-gray-500">{list.total || 0} registros en el periodo</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-white text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Ticket</th>
                <th className="px-4 py-3">Bruto</th>
                <th className="px-4 py-3">Comisión</th>
                <th className="px-4 py-3">Neto</th>
                <th className="px-4 py-3">Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(list.items || []).map((item: any) => (
                <tr key={item._id || item.releaseRef}>
                  <td className="px-4 py-3 text-gray-600">{item.createdAt ? new Date(item.createdAt).toLocaleString('es-ES') : '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{String(item.ticketId || '-').slice(-8)}</td>
                  <td className="px-4 py-3">{eur(item.gross)}</td>
                  <td className="px-4 py-3">{eur(item.fee)}</td>
                  <td className="px-4 py-3">{eur(item.netToPro)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.releaseRef || '-'}</td>
                </tr>
              ))}
              {!loading && !(list.items || []).length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No hay movimientos en el periodo seleccionado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
