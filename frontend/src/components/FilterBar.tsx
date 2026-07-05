import React, { useState } from 'react';
import { type SearchParams } from '../services/properties';
import { Search, MapPin, Euro, BedDouble, Bath, ArrowUpDown, FilterX } from 'lucide-react';

type Props = {
  initial: Partial<SearchParams & { onlyTenantPro?: boolean }>;
  onApply: (filters: Partial<SearchParams & { onlyTenantPro?: boolean }>) => void;
};

export default function FilterBar({ initial, onApply }: Props) {
  type FilterState = Partial<SearchParams & { onlyTenantPro?: boolean }> & {
    sort?: SearchParams['sort'];
    dir?: SearchParams['dir'];
  };

  const [state, setState] = useState<FilterState>({
    limit: 12,
    sort: 'createdAt',
    dir: 'desc',
    ...initial,
  });

  const update = (k: keyof FilterState, v: any) => setState(s => ({ ...s, [k]: v }));

  const TogglePill = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-[13px] font-medium transition-all border ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3.5">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            placeholder="Buscar por título…"
            value={state.q || ''}
            onChange={e => update('q', e.target.value)}
          />
        </div>
        <div className="md:col-span-3 relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
            placeholder="Ciudad / Zona"
            value={state.city || ''}
            onChange={e => update('city', e.target.value)}
          />
        </div>
        <div className="md:col-span-5 flex items-center gap-1 rounded-lg border border-gray-200 px-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <div className="pl-1 text-gray-400"><Euro size={16}/></div>
          <input
            className="w-full border-none text-sm focus:ring-0 p-1.5 outline-none"
            type="number" placeholder="Precio mín."
            value={state.priceMin ?? ''}
            onChange={e => update('priceMin', e.target.value ? Number(e.target.value) : undefined)}
          />
          <span className="text-gray-200">—</span>
          <input
            className="w-full border-none text-sm focus:ring-0 p-1.5 outline-none"
            type="number" placeholder="Precio máx."
            value={state.priceMax ?? ''}
            onChange={e => update('priceMax', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 h-10">
            <BedDouble size={15} className="text-gray-400" />
            <input
              type="number" placeholder="Hab+"
              className="w-11 text-sm border-none focus:ring-0 p-0 outline-none"
              value={state.roomsMin ?? ''}
              onChange={e => update('roomsMin', e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 h-10">
            <Bath size={15} className="text-gray-400" />
            <input
              type="number" placeholder="Baño+"
              className="w-11 text-sm border-none focus:ring-0 p-0 outline-none"
              value={state.bathMin ?? ''}
              onChange={e => update('bathMin', e.target.value)}
            />
          </div>
          <div className="h-7 w-px bg-gray-200 mx-1 hidden md:block"></div>
          <TogglePill label="Amueblado" active={!!state.furnished} onClick={() => update('furnished', !state.furnished)} />
          <TogglePill label="Mascotas" active={!!state.petsAllowed} onClick={() => update('petsAllowed', !state.petsAllowed)} />
          <TogglePill label="Solo Tenant PRO" active={!!state.onlyTenantPro} onClick={() => update('onlyTenantPro', !state.onlyTenantPro)} />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 h-10">
            <ArrowUpDown size={14} className="text-gray-400"/>
            <select
              className="h-9 text-sm border-none focus:ring-0 bg-transparent text-gray-600 cursor-pointer outline-none"
              value={`${state.sort}-${state.dir}`}
              onChange={e => {
                const [sort, dir] = e.target.value.split('-') as [SearchParams['sort'], SearchParams['dir']];
                setState(s => ({ ...s, sort, dir }));
              }}
            >
              <option value="createdAt-desc">Nuevos primero</option>
              <option value="price-asc">Precio: Bajo a Alto</option>
              <option value="price-desc">Precio: Alto a Bajo</option>
              <option value="views-desc">Populares</option>
            </select>
          </div>

          <button
            onClick={() => onApply(state)}
            className="bg-gray-950 text-white px-5 h-10 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            Buscar
          </button>

          <button
            onClick={() => onApply({})}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Borrar filtros"
          >
            <FilterX size={19} />
          </button>
        </div>
      </div>
    </div>
  );
}
