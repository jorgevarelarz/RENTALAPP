import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listMyTickets } from '../../services/tickets';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import Card from '../ui/Card';
import StatusBadge from '../ui/StatusBadge';
import { formatTicketDate, getServiceLabel } from '../../utils/tickets';

const PAGE_SIZE = 20;

const pagerButton =
  'rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:opacity-50';

export type ProTicketFilter = { value: string; label: string; count?: number };

type Props = {
  /** Clave de la caché de react-query (una por pantalla). */
  queryKey: string;
  filters: ProTicketFilter[];
  /** Texto cuando el profesional no tiene nada en ningún filtro. */
  emptyText: string;
  /** Importe y detalle a la derecha de cada fila. */
  renderAmount: (ticket: any) => React.ReactNode;
};

/** Lista paginada en el servidor de las incidencias del profesional, con búsqueda y filtros por estado. */
export default function ProTicketList({ queryKey, filters, emptyText, renderAmount }: Props) {
  const [status, setStatus] = useState(filters[0]?.value || '');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const search = useDebouncedValue(q.trim(), 300);
  const { data, isLoading, isError } = useQuery({
    queryKey: [queryKey, { page, status, search }],
    queryFn: () => listMyTickets('pro', { page, status: status || undefined, q: search || undefined, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const currentPage = data?.page || page;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const choose = (value: string) => { setStatus(value); setPage(1); };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
          {filters.map(f => (
            <button
              key={f.value || 'all'}
              type="button"
              aria-pressed={status === f.value}
              onClick={() => choose(f.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                status === f.value
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-[var(--border)] bg-[var(--card)] text-gray-700 hover:bg-gray-50'
              }`}
            >
              {f.label}
              {typeof f.count === 'number' && (
                <span className={`ml-1.5 tabular-nums ${status === f.value ? 'text-white/70' : 'text-gray-400'}`}>{f.count}</span>
              )}
            </button>
          ))}
        </div>
        <label className="relative block w-full md:max-w-xs">
          <span className="sr-only">Buscar trabajos</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por título o servicio"
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] py-2 pl-9 pr-3 text-sm focus:border-gray-400 focus:outline-none"
          />
        </label>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-6 text-sm text-gray-500">Cargando trabajos…</div>
        ) : isError ? (
          <div className="px-5 py-6 text-sm text-red-700">No se pudieron cargar los trabajos. Vuelve a intentarlo en un momento.</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500">
            {search ? 'Ningún trabajo coincide con la búsqueda.' : emptyText}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((ticket: any) => {
              const updated = formatTicketDate(ticket.updatedAt || ticket.createdAt);
              return (
                <li key={ticket._id}>
                  <Link
                    to={`/tickets/${ticket._id}`}
                    className="group flex flex-col gap-2 px-5 py-4 hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{ticket.title}</p>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                        <span>{getServiceLabel(ticket.service)}</span>
                        {updated && <span>Actualizada el {updated}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:text-right">
                      <div>{renderAmount(ticket)}</div>
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

/** Cifras del resumen en una sola tarjeta, separadas por una línea fina (dos, lado a lado también en móvil). */
export function SummaryFigures({ figures }: { figures: Array<{ label: string; value: React.ReactNode; hint?: string }> }) {
  return (
    <Card className="grid grid-cols-2 divide-x divide-gray-100">
      {figures.map(f => (
        <div key={f.label} className="min-w-0 px-4 py-4 sm:px-5">
          <p className="text-sm text-gray-500">{f.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 sm:text-2xl">{f.value}</p>
          {f.hint && <p className="mt-0.5 text-xs text-gray-500">{f.hint}</p>}
        </div>
      ))}
    </Card>
  );
}
