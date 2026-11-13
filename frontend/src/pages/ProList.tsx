import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MapPin } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listPros } from '../services/pro';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import { TICKET_SERVICES, getServiceLabel } from '../utils/tickets';
import { proPriceText, proRatingText } from '../utils/pros';

const PAGE_SIZE = 20;

const pagerButton =
  'rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:opacity-50';

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? 'border-gray-900 bg-gray-900 text-white' : 'border-[var(--border)] bg-[var(--card)] text-gray-700 hover:bg-gray-50'
  }`;

/** Directorio de profesionales: filtros por servicio y ciudad en el servidor, paginado. */
const ProList: React.FC = () => {
  const [service, setService] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);
  const cityQuery = useDebouncedValue(city.trim(), 300);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pros', { service, city: cityQuery, page }],
    queryFn: () => listPros({ service: service || undefined, city: cityQuery || undefined, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const items = data?.items || [];
  const total = data?.total || 0;
  const currentPage = data?.page || page;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(service || cityQuery);

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <PageHeader
        title="Profesionales"
        subtitle="Fontaneros, electricistas y otros oficios a los que puedes asignar las averías de tus viviendas."
      />

      <div className="space-y-3">
        <div role="group" aria-label="Filtrar por servicio" className="flex flex-wrap gap-2">
          {['', ...TICKET_SERVICES].map(key => (
            <button
              key={key || 'all'}
              type="button"
              aria-pressed={service === key}
              onClick={() => { setService(key); setPage(1); }}
              className={chip(service === key)}
            >
              {key ? getServiceLabel(key) : 'Todos'}
            </button>
          ))}
        </div>
        <label className="relative block max-w-xs">
          <span className="sr-only">Ciudad</span>
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Ciudad"
            value={city}
            onChange={e => { setCity(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] py-2 pl-9 pr-3 text-sm focus:border-gray-400 focus:outline-none"
          />
        </label>
      </div>

      <div>
        {!isLoading && !isError && total > 0 && (
          <p className="mb-2 text-sm text-gray-500 tabular-nums">{total === 1 ? '1 profesional' : `${total} profesionales`}</p>
        )}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="px-5 py-6 text-sm text-gray-500">Cargando profesionales…</div>
          ) : isError ? (
            <div className="px-5 py-6 text-sm text-red-700">No se pudo cargar el directorio. Vuelve a intentarlo en un momento.</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col gap-3 px-5 py-6 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
              <span>{filtered ? 'Nadie coincide con estos filtros.' : 'Todavía no hay profesionales en el directorio.'}</span>
              {filtered && (
                <button
                  type="button"
                  onClick={() => { setService(''); setCity(''); setPage(1); }}
                  className="self-start font-medium text-gray-900 underline-offset-2 hover:underline"
                >
                  Quitar filtros
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((pro: any) => {
                const rating = proRatingText(pro);
                const price = proPriceText(pro, service);
                const services = (pro.services || []).map((s: any) => getServiceLabel(s.key)).join(', ');
                return (
                  <li key={pro._id}>
                    <Link
                      to={`/pros/${pro._id}`}
                      className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{pro.displayName}</p>
                        <p className="mt-1 text-sm text-gray-600">
                          {[pro.city, rating].filter(Boolean).join(' · ')}
                        </p>
                        {services && <p className="mt-0.5 text-sm text-gray-500 [overflow-wrap:anywhere]">{services}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {price && <span className="text-sm tabular-nums text-gray-700">{price}</span>}
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" aria-hidden="true" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

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
};

export default ProList;
