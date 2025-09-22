import React, { useState } from 'react';
import { type SearchParams } from '../services/properties';

type Props = {
  initial: Partial<SearchParams & { onlyTenantPro?: boolean }>;
  onApply: (filters: Partial<SearchParams & { onlyTenantPro?: boolean }>) => void;
};

export default function FilterBar({ initial, onApply }: Props) {
  const [state, setState] = useState<Partial<SearchParams & { onlyTenantPro?: boolean }>>({
    limit: 12,
    sort: 'createdAt',
    dir: 'desc',
    ...initial,
  });

  const update = (k: keyof typeof state, v: any) => setState(s => ({ ...s, [k]: v }));

  return (
    <div className="rounded border border-gray-200 p-3 bg-gray-50">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input className="h-9 px-3 rounded border border-gray-300" placeholder="Buscar…" value={state.q || ''} onChange={e => update('q', e.target.value)} />
        <input className="h-9 px-3 rounded border border-gray-300" placeholder="Región" value={state.region || ''} onChange={e => update('region', e.target.value)} />
        <input className="h-9 px-3 rounded border border-gray-300" placeholder="Ciudad" value={state.city || ''} onChange={e => update('city', e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <input className="h-9 px-3 rounded border border-gray-300" type="number" placeholder="€ mín" value={state.priceMin ?? ''} onChange={e => update('priceMin', e.target.value ? Number(e.target.value) : undefined)} />
          <input className="h-9 px-3 rounded border border-gray-300" type="number" placeholder="€ máx" value={state.priceMax ?? ''} onChange={e => update('priceMax', e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input className="h-9 px-3 rounded border border-gray-300" type="number" placeholder="Hab mín" value={state.roomsMin ?? ''} onChange={e => update('roomsMin', e.target.value ? Number(e.target.value) : undefined)} />
          <input className="h-9 px-3 rounded border border-gray-300" type="number" placeholder="Hab máx" value={state.roomsMax ?? ''} onChange={e => update('roomsMax', e.target.value ? Number(e.target.value) : undefined)} />
          <input className="h-9 px-3 rounded border border-gray-300" type="number" placeholder="Baños mín" value={state.bathMin ?? ''} onChange={e => update('bathMin', e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!state.furnished} onChange={e => update('furnished', e.target.checked)} /> Amueblado
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!state.petsAllowed} onChange={e => update('petsAllowed', e.target.checked)} /> Mascotas
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!state.onlyTenantPro} onChange={e => update('onlyTenantPro', e.target.checked)} /> Solo PRO
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select className="h-9 px-2 rounded border border-gray-300" value={state.sort} onChange={e => update('sort', e.target.value)}>
            <option value="createdAt">Más recientes</option>
            <option value="price">Precio</option>
            <option value="views">Más vistos</option>
          </select>
          <select className="h-9 px-2 rounded border border-gray-300" value={state.dir} onChange={e => update('dir', e.target.value)}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
        <div className="flex sm:col-span-2 lg:col-span-1 items-center gap-2">
          <button className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-100" onClick={() => onApply(state)}>Aplicar filtros</button>
          <button className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-100" onClick={() => onApply({})}>Borrar</button>
        </div>
      </div>
    </div>
  );
}

