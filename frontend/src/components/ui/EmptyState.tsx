import React from 'react';

type Props = {
  title: string;
  detail?: string;
  cta?: React.ReactNode;
};

// Vacío de una lista: qué pasa y qué hacer, sin ilustraciones
export default function EmptyState({ title, detail, cta }: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--ra-line)] bg-white px-5 py-6 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 [overflow-wrap:anywhere]">{title}</p>
        {detail && <p className="mt-1 text-sm text-gray-500">{detail}</p>}
      </div>
      {cta && <div className="shrink-0">{cta}</div>}
    </div>
  );
}
