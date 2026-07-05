import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Send, Clock3, CheckCircle2 } from 'lucide-react';
import { listMyTickets } from '../../services/tickets';
import StatusBadge from '../../components/ui/StatusBadge';

const eur = (value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

export default function ProQuotes() {
  const { data, isLoading } = useQuery({
    queryKey: ['pro/quotes'],
    queryFn: () => listMyTickets('pro', { limit: 100 }),
  });
  const items = data?.items || [];
  const quoted = useMemo(() => items.filter((t: any) => t.quote), [items]);
  const pending = items.filter((t: any) => t.status === 'open');
  const awaitingApproval = items.filter((t: any) => t.status === 'quoted');
  const approved = items.filter((t: any) => ['awaiting_schedule', 'scheduled', 'in_progress', 'awaiting_approval', 'done', 'closed'].includes(t.status));
  const quotedTotal = quoted.reduce((sum: number, t: any) => sum + Number(t.quote?.amount || 0), 0);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">Presupuestos</h2>
        <p className="mt-1 text-sm text-gray-500">Controla oportunidades, presupuestos enviados y trabajos aprobados.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric icon={<Send size={17} />} label="Por enviar" value={pending.length} />
        <Metric icon={<Clock3 size={17} />} label="Esperando aprobación" value={awaitingApproval.length} />
        <Metric icon={<CheckCircle2 size={17} />} label="Aprobados" value={approved.length} />
        <Metric icon={<FileText size={17} />} label="Importe presupuestado" value={eur(quotedTotal)} />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">Incidencia</th>
              <th className="px-4 py-3">Servicio</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Presupuesto</th>
              <th className="px-4 py-3">Actualizado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-gray-500">Cargando...</td></tr>}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-gray-500">Aún no tienes incidencias asignadas para presupuestar.</td></tr>
            )}
            {items.map((ticket: any) => (
              <tr key={ticket._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-950">{ticket.title}</td>
                <td className="px-4 py-3 text-gray-600">{ticket.service || '-'}</td>
                <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                <td className="px-4 py-3 font-semibold text-gray-900">{ticket.quote ? eur(Number(ticket.quote.amount || 0)) : 'Pendiente'}</td>
                <td className="px-4 py-3 text-gray-500">{ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString('es-ES') : '-'}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/tickets/${ticket._id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                    {ticket.quote ? 'Ver' : 'Enviar'}
                  </Link>
                </td>
              </tr>
            ))}
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
