import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Receipt, Wallet, AlertCircle } from 'lucide-react';
import { listMyTickets } from '../../services/tickets';
import StatusBadge from '../../components/ui/StatusBadge';

const eur = (value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const billableStatuses = ['in_progress', 'awaiting_approval', 'done', 'closed'];

export default function ProBilling() {
  const { data, isLoading } = useQuery({
    queryKey: ['pro/billing'],
    queryFn: () => listMyTickets('pro', { limit: 100 }),
  });
  const items = data?.items || [];
  const billable = useMemo(
    () => items.filter((t: any) => t.quote && billableStatuses.includes(t.status)),
    [items],
  );
  const done = billable.filter((t: any) => ['done', 'closed'].includes(t.status));
  const pending = billable.filter((t: any) => !['done', 'closed'].includes(t.status));
  const total = billable.reduce((sum: number, t: any) => sum + Number(t.quote?.amount || 0) + Number(t.extra?.status === 'approved' ? t.extra?.amount || 0 : 0), 0);
  const closedTotal = done.reduce((sum: number, t: any) => sum + Number(t.quote?.amount || 0) + Number(t.extra?.status === 'approved' ? t.extra?.amount || 0 : 0), 0);

  const exportCsv = () => {
    const header = 'ticket,status,quote,extra,total,updatedAt\n';
    const body = billable.map((t: any) => {
      const quote = Number(t.quote?.amount || 0);
      const extra = Number(t.extra?.status === 'approved' ? t.extra?.amount || 0 : 0);
      return [t._id, t.status, quote, extra, quote + extra, t.updatedAt || ''].join(',');
    }).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rentalapp_pro_billing.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-950">Facturación</h2>
          <p className="mt-1 text-sm text-gray-500">Importes presupuestados, extras aprobados y trabajos listos para facturar.</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!billable.length}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download size={16} /> Exportar CSV
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<Wallet size={17} />} label="Total facturable" value={eur(total)} />
        <Metric icon={<Receipt size={17} />} label="Trabajos cerrados" value={eur(closedTotal)} />
        <Metric icon={<AlertCircle size={17} />} label="Pendiente de cierre" value={pending.length} />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Trabajo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Base</th>
              <th className="px-4 py-3">Extra</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-gray-500">Cargando...</td></tr>}
            {!isLoading && billable.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-gray-500">Aún no hay trabajos facturables.</td></tr>
            )}
            {billable.map((ticket: any) => {
              const quote = Number(ticket.quote?.amount || 0);
              const extra = Number(ticket.extra?.status === 'approved' ? ticket.extra?.amount || 0 : 0);
              return (
                <tr key={ticket._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-950">{ticket.title}</td>
                  <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                  <td className="px-4 py-3 text-gray-700">{eur(quote)}</td>
                  <td className="px-4 py-3 text-gray-700">{extra ? eur(extra) : '-'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-950">{eur(quote + extra)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/tickets/${ticket._id}`} className="font-medium text-indigo-600 hover:text-indigo-800">Ver</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-950">{value}</div>
    </div>
  );
}
