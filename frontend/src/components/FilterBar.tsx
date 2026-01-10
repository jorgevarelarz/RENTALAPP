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
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
        active
          ? 'bg-blue-600 text-white border-blue-600 shadow-md'
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="Buscar por título..."
            value={state.q || ''}
            onChange={e => update('q', e.target.value)}
          />
        </div>
        <div className="md:col-span-3 relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Ciudad / Zona"
            value={state.city || ''}
            onChange={e => update('city', e.target.value)}
          />
        </div>
        <div className="md:col-span-5 flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
          <div className="px-3 text-gray-400"><Euro size={18}/></div>
          <input
            className="w-full bg-transparent border-none text-sm focus:ring-0 p-1"
            type="number" placeholder="Mín"
            value={state.priceMin ?? ''}
            onChange={e => update('priceMin', e.target.value ? Number(e.target.value) : undefined)}
          />
          <span className="text-gray-300">|</span>
          <input
            className="w-full bg-transparent border-none text-sm focus:ring-0 p-1"
            type="number" placeholder="Máx"
            value={state.priceMax ?? ''}
            onChange={e => update('priceMax', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 h-10">
            <BedDouble size={16} className="text-gray-400" />
            <input
              type="number" placeholder="Hab+"
              className="w-12 text-sm border-none focus:ring-0 p-0"
              value={state.roomsMin ?? ''}
              onChange={e => update('roomsMin', e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 h-10">
            <Bath size={16} className="text-gray-400" />
            <input
              type="number" placeholder="Baño+"
              className="w-12 text-sm border-none focus:ring-0 p-0"
              value={state.bathMin ?? ''}
              onChange={e => update('bathMin', e.target.value)}
            />
          </div>
          <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block"></div>
          <TogglePill label="Amueblado" active={!!state.furnished} onClick={() => update('furnished', !state.furnished)} />
          <TogglePill label="Mascotas" active={!!state.petsAllowed} onClick={() => update('petsAllowed', !state.petsAllowed)} />
          <TogglePill label="Solo Tenant PRO" active={!!state.onlyTenantPro} onClick={() => update('onlyTenantPro', !state.onlyTenantPro)} />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 bg-white">
            <ArrowUpDown size={14} className="text-gray-400"/>
            <select
              className="h-9 text-sm border-none focus:ring-0 bg-transparent text-gray-600 cursor-pointer"
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
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            Buscar
          </button>

          <button
            onClick={() => onApply({})}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Borrar filtros"
          >
            <FilterX size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
