import React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import Card from '../ui/Card';
import Stars from './Stars';
import { getProReviews } from '../../services/reviews';

const monthYear = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' });
const PAGE = 5;

/** Opiniones de quienes contrataron al profesional en una incidencia, las más recientes primero. */
export default function ProReviews({ proProfileId, ratingAvg, reviewCount }: { proProfileId: string; ratingAvg?: number; reviewCount?: number }) {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: ['pros', proProfileId, 'reviews'],
    queryFn: ({ pageParam }) => getProReviews(proProfileId, pageParam, PAGE),
    initialPageParam: 1,
    getNextPageParam: last => (last.page * last.limit < last.total ? last.page + 1 : undefined),
  });
  const items = data?.pages.flatMap(p => p.items) ?? [];
  const total = data?.pages[0]?.total ?? reviewCount ?? 0;
  const avg = (Number(ratingAvg) || 0).toFixed(1).replace('.', ',');

  return (
    <Card className="overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Opiniones</h2>
        {total > 0 && (
          <span className="flex items-center gap-2 text-sm text-gray-600">
            <Stars score={Number(ratingAvg) || 0} />
            <span className="tabular-nums">{avg} · {total} {total === 1 ? 'opinión' : 'opiniones'}</span>
          </span>
        )}
      </div>
      {isLoading && <p className="px-5 py-4 text-sm text-gray-500">Cargando opiniones…</p>}
      {isError && (
        <p className="px-5 py-4 text-sm text-red-700">
          No se pudieron cargar las opiniones.{' '}
          <button type="button" onClick={() => refetch()} className="font-medium underline-offset-2 hover:underline">Reintentar</button>
        </p>
      )}
      {!isLoading && !isError && items.length === 0 && (
        <p className="px-5 py-4 text-sm text-gray-500">Aún no tiene opiniones. Las dejan propietarios e inquilinos cuando se cierra una incidencia que ha resuelto.</p>
      )}
      {items.length > 0 && (
        <ul className="divide-y divide-gray-100">
          {items.map(r => (
            <li key={r.id} className="space-y-1 px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars score={r.score} />
                <span className="text-sm font-medium text-gray-900">{r.author}</span>
                <span className="text-xs text-gray-500">{monthYear.format(new Date(r.createdAt))}</span>
              </div>
              {r.comment && <p className="whitespace-pre-wrap text-sm text-gray-700 [overflow-wrap:anywhere]">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
      {hasNextPage && (
        <div className="border-t border-gray-100 px-5 py-3">
          <button type="button" disabled={isFetchingNextPage} onClick={() => fetchNextPage()} className="text-sm font-medium text-gray-700 underline-offset-2 hover:underline">
            {isFetchingNextPage ? 'Cargando…' : 'Ver más opiniones'}
          </button>
        </div>
      )}
    </Card>
  );
}
