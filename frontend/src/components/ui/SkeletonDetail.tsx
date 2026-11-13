import React from 'react';

const block = 'bg-[var(--ra-paper)] motion-safe:animate-pulse';

// Misma maqueta que PropertyDetail: galería, texto a la izquierda y tarjeta de precio a la derecha
export default function SkeletonDetail() {
  return (
    <div role="status" aria-busy="true" className="lg:pb-12">
      <span className="sr-only">Cargando la vivienda…</span>
      <div aria-hidden="true">
        <div className="mb-3 h-9" />
        <div className={`h-[260px] rounded-2xl sm:h-[360px] lg:h-[440px] ${block}`} />
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <div className={`h-8 w-2/3 rounded ${block}`} />
            <div className={`h-4 w-1/2 rounded ${block}`} />
            <div className={`h-4 w-1/3 rounded ${block}`} />
            <div className="space-y-2 pt-6">
              <div className={`h-3.5 w-full rounded ${block}`} />
              <div className={`h-3.5 w-11/12 rounded ${block}`} />
              <div className={`h-3.5 w-4/5 rounded ${block}`} />
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--ra-line)] bg-white p-6">
            <div className={`h-8 w-36 rounded ${block}`} />
            <div className={`mt-2 h-4 w-28 rounded ${block}`} />
            <div className={`mt-6 h-11 w-full rounded-lg ${block}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
