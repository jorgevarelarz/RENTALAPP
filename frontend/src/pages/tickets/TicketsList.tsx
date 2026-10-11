import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listMyTickets } from "../../services/tickets";
import { useAuth } from "../../context/AuthContext";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { TICKET_STATUS_FILTERS, formatEuros, formatTicketDate, getServiceLabel } from "../../utils/tickets";

const PAGE_SIZE = 20;

const primaryLink =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90';
const pagerButton =
  'rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:opacity-50';

const SUBTITLES: Record<string, string> = {
  tenant: 'Las averías que has comunicado y en qué punto están.',
  landlord: 'Las averías de tus inmuebles: asigna un profesional, aprueba el presupuesto y valida el trabajo.',
  pro: 'Los trabajos que te han asignado y lo que falta en cada uno.',
};

const EMPTY_TEXT: Record<string, string> = {
  tenant: 'Si algo se estropea en tu vivienda, comunícalo aquí y tu arrendador lo verá al momento.',
  landlord: 'Cuando un inquilino comunique una avería, aparecerá aquí.',
  pro: 'Cuando un propietario te asigne un trabajo, aparecerá aquí.',
};

export default function TicketsList() {
  const { user } = useAuth();
  const role = user?.role === "pro" ? "pro" : user?.role === "landlord" ? "landlord" : "tenant";
  const [sp, setSp] = useSearchParams();
  const [page, setPage] = useState(() => Math.max(1, Number(sp.get('page')) || 1));
  const [q, setQ] = useState(() => sp.get('q') || "");
  const [status, setStatus] = useState(() => sp.get('status') || "");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tickets", role, { page, status }],
    queryFn: async () => listMyTickets(role, { page, status, limit: PAGE_SIZE }),
  });

  // Sincroniza query params ↔ estado
  React.useEffect(() => {
    const next = new URLSearchParams();
    if (page > 1) next.set('page', String(page));
    if (q) next.set('q', q);
    if (status) next.set('status', status);
    if (next.toString() !== sp.toString()) setSp(next, { replace: true });
  }, [page, q, status, sp, setSp]);

  const items = useMemo(() => data?.items || [], [data]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(t =>
      String(t.title || "").toLowerCase().includes(term) ||
      getServiceLabel(t.service).toLowerCase().includes(term)
    );
  }, [items, q]);

  const total = data?.total || 0;
  const currentPage = data?.page || page;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const nothingAtAll = !isLoading && !isError && total === 0 && !status;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Incidencias"
        subtitle={SUBTITLES[role]}
        cta={role === 'tenant' ? <Link to="/tickets/new" className={primaryLink}>Comunicar una avería</Link> : undefined}
      />

      {!nothingAtAll && (
        <div className="space-y-3">
          <label className="relative block max-w-md">
            <span className="sr-only">Buscar incidencias</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar por título o servicio"
              value={q}
              onChange={e => setQ(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] py-2 pl-9 pr-3 text-sm focus:border-gray-400 focus:outline-none"
            />
          </label>
          <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
            {TICKET_STATUS_FILTERS.map(f => (
              <button
                key={f.value || 'all'}
                type="button"
                aria-pressed={status === f.value}
                onClick={() => { setStatus(f.value); setPage(1); }}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  status === f.value
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-[var(--border)] bg-[var(--card)] text-gray-700 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-6 text-sm text-gray-500">Cargando incidencias…</div>
        ) : isError ? (
          <div className="px-5 py-6 text-sm text-red-700">No se pudieron cargar las incidencias. Vuelve a intentarlo en un momento.</div>
        ) : nothingAtAll ? (
          <div className="flex flex-col gap-4 px-5 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-gray-900">No hay incidencias</p>
              <p className="mt-1 text-sm text-gray-500">{EMPTY_TEXT[role]}</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500">
            {q ? 'Ninguna incidencia coincide con la búsqueda.' : 'No hay incidencias en este estado.'}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map(ticket => {
              const updated = formatTicketDate(ticket.updatedAt || ticket.createdAt);
              const quote = formatEuros(ticket.quote?.amount);
              return (
                <li key={ticket._id}>
                  <Link
                    to={`/tickets/${ticket._id}`}
                    className="group flex flex-col gap-2 px-5 py-4 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{ticket.title}</p>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                        <span>{getServiceLabel(ticket.service)}</span>
                        {quote && <span className="tabular-nums">Presupuesto {quote}</span>}
                        {updated && <span>Actualizada el {updated}</span>}
                      </p>
                    </div>
                    <div className="order-first flex shrink-0 items-center gap-2 sm:order-none">
                      <StatusBadge status={ticket.status} />
                      <ChevronRight className="hidden h-4 w-4 text-gray-300 group-hover:text-gray-500 sm:block" aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className={pagerButton}>
            Anterior
          </button>
          <span className="text-sm text-gray-500 tabular-nums">Página {currentPage} de {pages}</span>
          <button type="button" disabled={currentPage >= pages} onClick={() => setPage(p => p + 1)} className={pagerButton}>
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
