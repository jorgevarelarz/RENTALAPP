import React, { useId, useState } from 'react';
import { type SearchParams } from '../services/properties';
import { Search, MapPin } from 'lucide-react';

type Filters = Partial<SearchParams & { onlyTenantPro?: boolean }>;

type Props = {
  initial: Filters;
  onApply: (filters: Filters) => void;
  onClear: () => void;
};

// Valor del selector de orden (`campo-dirección`), el mismo que entiende el backend
export const SORT_OPTIONS = [
  { value: 'createdAt-desc', label: 'Más recientes' },
  { value: 'price-asc', label: 'Más baratos' },
  { value: 'price-desc', label: 'Más caros' },
  { value: 'viewsCount-desc', label: 'Más vistos' },
] as const;

const field =
  'h-10 w-full rounded-lg border border-[var(--ra-line)] bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[var(--ra-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--ra-blue)]/20';
const submit =
  'h-10 whitespace-nowrap rounded-lg bg-[var(--ra-blue)] px-5 text-sm font-semibold text-white hover:bg-[#3557e6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ra-blue)] focus-visible:ring-offset-2';
const label = 'mb-1 block text-xs font-medium text-[var(--ra-muted)]';

function TogglePill({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-10 rounded-full border px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ra-blue)] focus-visible:ring-offset-1 ${
        active
          ? 'border-[var(--ra-blue)] bg-[var(--ra-blue)]/10 text-[var(--ra-blue)]'
          : 'border-[var(--ra-line)] bg-white text-gray-700 hover:border-gray-400'
      }`}
    >
      {children}
    </button>
  );
}

const toNumber = (v: string) => (v === '' ? undefined : Number(v));

export default function FilterBar({ initial, onApply, onClear }: Props) {
  const id = useId();
  const [state, setState] = useState<Filters>({
    limit: 12,
    sort: 'createdAt',
    dir: 'desc',
    ...initial,
  });

  const update = <K extends keyof Filters>(k: K, v: Filters[K]) => setState((s) => ({ ...s, [k]: v }));
  // Un interruptor apagado no filtra: «furnished=false» buscaría solo pisos sin amueblar
  const toggle = (k: 'furnished' | 'petsAllowed' | 'onlyTenantPro') => update(k, state[k] ? undefined : true);

  const sortValue = `${state.sort}-${state.dir}`;

  return (
    <form
      className="space-y-4 rounded-xl border border-[var(--ra-line)] bg-white p-4"
      role="search"
      aria-label="Filtros de búsqueda"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(state);
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-3">
          <label htmlFor={`${id}-q`} className={label}>Buscar</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} aria-hidden="true" />
            <input
              id={`${id}-q`}
              type="search"
              className={`${field} pl-9`}
              placeholder="Calle, barrio o título"
              value={state.q || ''}
              onChange={(e) => update('q', e.target.value || undefined)}
            />
          </div>
        </div>
        <div className="md:col-span-3">
          <label htmlFor={`${id}-city`} className={label}>Ciudad</label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} aria-hidden="true" />
            <input
              id={`${id}-city`}
              className={`${field} pl-9`}
              placeholder="Madrid"
              value={state.city || ''}
              onChange={(e) => update('city', e.target.value || undefined)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:col-span-4">
          <div>
            <label htmlFor={`${id}-min`} className={label}>Precio mín. (€/mes)</label>
            <input
              id={`${id}-min`}
              type="number"
              min={0}
              step={50}
              inputMode="numeric"
              className={field}
              placeholder="Sin mínimo"
              value={state.priceMin ?? ''}
              onChange={(e) => update('priceMin', toNumber(e.target.value))}
            />
          </div>
          <div>
            <label htmlFor={`${id}-max`} className={label}>Precio máx. (€/mes)</label>
            <input
              id={`${id}-max`}
              type="number"
              min={0}
              step={50}
              inputMode="numeric"
              className={field}
              placeholder="Sin máximo"
              value={state.priceMax ?? ''}
              onChange={(e) => update('priceMax', toNumber(e.target.value))}
            />
          </div>
        </div>
        {/* En móvil «Buscar» va al final del formulario */}
        <div className="hidden items-end md:col-span-2 md:flex">
          <button type="submit" className={`${submit} w-full`}>Buscar</button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--ra-line)] pt-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={`${id}-rooms`} className={label}>Habitaciones</label>
            <select
              id={`${id}-rooms`}
              className={`${field} w-28`}
              value={state.roomsMin ?? ''}
              onChange={(e) => update('roomsMin', toNumber(e.target.value))}
            >
              <option value="">Cualquiera</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} o más</option>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-bath`} className={label}>Baños</label>
            <select
              id={`${id}-bath`}
              className={`${field} w-28`}
              value={state.bathMin ?? ''}
              onChange={(e) => update('bathMin', toNumber(e.target.value))}
            >
              <option value="">Cualquiera</option>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n} o más</option>)}
            </select>
          </div>
          <TogglePill active={!!state.furnished} onClick={() => toggle('furnished')}>Amueblado</TogglePill>
          <TogglePill active={!!state.petsAllowed} onClick={() => toggle('petsAllowed')}>Mascotas</TogglePill>
          <TogglePill active={!!state.onlyTenantPro} onClick={() => toggle('onlyTenantPro')}>Solo Tenant PRO</TogglePill>
        </div>

        <div className="flex flex-wrap items-end gap-2 md:ml-auto">
          <div>
            <label htmlFor={`${id}-sort`} className={label}>Ordenar</label>
            <select
              id={`${id}-sort`}
              className={`${field} w-32`}
              value={SORT_OPTIONS.some((o) => o.value === sortValue) ? sortValue : 'createdAt-desc'}
              onChange={(e) => {
                const [sort, dir] = e.target.value.split('-') as [SearchParams['sort'], SearchParams['dir']];
                setState((s) => ({ ...s, sort, dir }));
              }}
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setState({ limit: 12, sort: 'createdAt', dir: 'desc' });
              onClear();
            }}
            className="h-10 whitespace-nowrap rounded-lg px-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ra-blue)]"
          >
            Borrar filtros
          </button>
        </div>
      </div>
      <button type="submit" className={`${submit} w-full md:hidden`}>Buscar</button>
    </form>
  );
}
