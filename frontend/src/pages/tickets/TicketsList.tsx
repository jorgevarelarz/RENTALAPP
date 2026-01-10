import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listMyTickets } from "../../services/tickets";
import { useAuth } from "../../context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";

export default function TicketsList() {
  const { user } = useAuth();
  const role = user?.role === "pro" ? "pro" : user?.role === "landlord" ? "landlord" : "tenant";
  const [sp, setSp] = useSearchParams();
  const [page, setPage] = useState(() => Number(sp.get('page') || 1));
  const [q, setQ] = useState(() => sp.get('q') || "");
  const [status, setStatus] = useState(() => sp.get('status') || "");
  const [showFilters, setShowFilters] = useState(true);
  const { data, isLoading } = useQuery({
    queryKey: ["tickets", role, { page, status }],
    queryFn: async () => listMyTickets(role as any, { page, status }),
  });

  // Sincroniza query params ↔ estado
  React.useEffect(() => {
    const next = new URLSearchParams();
    next.set('page', String(page));
    if (q) next.set('q', q);
    if (status) next.set('status', status);
    if (next.toString() !== sp.toString()) setSp(next, { replace: true });
  }, [page, q, status, sp, setSp]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const items = data?.items || [];
    if (!term) return items;
    return items.filter(t =>
      String(t.title || "").toLowerCase().includes(term) ||
      String(t.status || "").toLowerCase().includes(term) ||
      String(t.service || "").toLowerCase().includes(term)
    );
  }, [data, q]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Incidencias"
        subtitle="Estado y seguimiento de tickets abiertos."
        cta={(
          <>
            {role === 'tenant' && (
              <Link
                to="/tickets/new"
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                Abrir incidencia
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className="inline-flex items-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              aria-expanded={showFilters}
              aria-controls="tickets-filters"
            >
              {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
            </button>
          </>
        )}
      />

      {showFilters && (
        <div id="tickets-filters" className="grid gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <input
            placeholder="Buscar por titulo, estado o servicio..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Estado</label>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="open">Abierto</option>
              <option value="quoted">Presupuestado</option>
              <option value="awaiting_schedule">Pendiente de cita</option>
              <option value="scheduled">Programado</option>
              <option value="in_progress">En curso</option>
              <option value="awaiting_approval">Pendiente de aprobación</option>
              <option value="done">Finalizado</option>
              <option value="closed">Cerrado</option>
            </select>
          </div>
        </div>
      )}

      {isLoading && <div className="text-sm text-gray-500">Cargando...</div>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Titulo</th>
              <th className="px-4 py-3">Servicio</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Actualizado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {filtered.map((ticket) => (
              <tr key={ticket._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{ticket._id.slice(-6)}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{ticket.title}</td>
                <td className="px-4 py-3 text-gray-600">{ticket.service}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={ticket.status} />
                </td>
                <td className="px-4 py-3 text-gray-600">{new Date(ticket.updatedAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/tickets/${ticket._id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
            {!((data?.items || []).length) && !isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8">
                  <EmptyState
                    title="No hay incidencias"
                    detail="Todo funciona bien. Si surge un problema, puedes abrir un ticket."
                    cta={role === 'tenant' ? (
                      <Link to="/tickets/new" className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        Abrir incidencia
                      </Link>
                    ) : undefined}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          disabled={(data?.page || 1) <= 1}
          onClick={() => setPage(p => Math.max(1, p - 1))}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-xs text-gray-500">Pagina {data?.page || 1}</span>
        <button
          disabled={((data?.page || 1) * 10) >= (data?.total || 0)}
          onClick={() => setPage(p => p + 1)}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
