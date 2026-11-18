import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import Card from './ui/Card';

export type OnboardingItem = { label: string; to: string; done: boolean };

/**
 * Primeros pasos de una cuenta nueva. Cada página calcula qué está hecho con sus propios datos;
 * cuando no queda nada pendiente, la tarjeta desaparece.
 */
export default function OnboardingChecklist({ items }: { items: OnboardingItem[] }) {
  const pending = items.filter((item) => !item.done).length;
  if (!items.length || pending === 0) return null;
  const done = items.length - pending;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold text-gray-950">Primeros pasos</h2>
        <p className="text-sm text-gray-500">
          {done} de {items.length} hechos
        </p>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              to={item.to}
              className={`flex h-full items-center gap-2 rounded-md border px-3 py-2 text-sm hover:border-gray-300 hover:bg-white ${
                item.done ? 'border-gray-100 bg-white text-gray-500' : 'border-gray-100 bg-gray-50 text-gray-900'
              }`}
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
              )}
              <span>{item.label}</span>{' '}
              <span className="sr-only">{item.done ? '(hecho)' : '(pendiente)'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
