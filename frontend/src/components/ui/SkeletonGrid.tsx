import React from 'react';

const bar = 'rounded bg-[var(--ra-paper)] motion-safe:animate-pulse';

// Misma rejilla y proporciones que PropertyCard, para que el listado no salte al cargar
export default function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true" className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">Cargando viviendas…</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden="true">
          <div className="aspect-[4/3] rounded-xl border border-[var(--ra-line)] bg-[var(--ra-paper)] motion-safe:animate-pulse" />
          <div className="space-y-2 pt-3">
            <div className={`h-3.5 w-1/3 ${bar}`} />
            <div className={`h-4 w-3/4 ${bar}`} />
            <div className={`h-3.5 w-1/2 ${bar}`} />
            <div className={`h-4 w-24 ${bar}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
