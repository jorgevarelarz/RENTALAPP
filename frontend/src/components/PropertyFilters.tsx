import React, { useState } from 'react';
import type { SearchParams } from '../services/properties';

type Props = {
  initial?: Partial<SearchParams>;
  onApply: (params: SearchParams) => void;
};

export default function PropertyFilters({ initial = {}, onApply }: Props) {
  const [state, setState] = useState<SearchParams>({ sort: 'createdAt', dir: 'desc', limit: 12, ...initial });
  const update = (key: keyof SearchParams, value: any) => {
    setState(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <input
          placeholder="Buscar…"
          value={state.q || ''}
          onChange={event => update('q', event.target.value)}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input
            placeholder="Región"
            value={state.region || ''}
            onChange={event => update('region', event.target.value)}
          />
          <input
            placeholder="Ciudad"
            value={state.city || ''}
            onChange={event => update('city', event.target.value)}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input
            type="number"
            placeholder="Precio mín"
            value={state.priceMin ?? ''}
            onChange={event => update('priceMin', event.target.value ? Number(event.target.value) : undefined)}
          />
          <input
            type="number"
            placeholder="Precio máx"
            value={state.priceMax ?? ''}
            onChange={event => update('priceMax', event.target.value ? Number(event.target.value) : undefined)}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <input
            type="number"
            placeholder="Hab mín"
            value={state.roomsMin ?? ''}
            onChange={event => update('roomsMin', event.target.value ? Number(event.target.value) : undefined)}
          />
          <input
            type="number"
            placeholder="Hab máx"
            value={state.roomsMax ?? ''}
            onChange={event => update('roomsMax', event.target.value ? Number(event.target.value) : undefined)}
          />
          <input
            type="number"
            placeholder="Baños mín"
            value={state.bathMin ?? ''}
            onChange={event => update('bathMin', event.target.value ? Number(event.target.value) : undefined)}
          />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label>
            <input type="checkbox" checked={!!state.furnished} onChange={event => update('furnished', event.target.checked)} />
            {' '}Amueblado
          </label>
          <label>
            <input type="checkbox" checked={!!state.petsAllowed} onChange={event => update('petsAllowed', event.target.checked)} />
            {' '}Mascotas
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <select value={state.sort} onChange={event => update('sort', event.target.value as SearchParams['sort'])}>
            <option value="createdAt">Más recientes</option>
            <option value="price">Precio</option>
            <option value="views">Más vistos</option>
          </select>
          <select value={state.dir} onChange={event => update('dir', event.target.value as SearchParams['dir'])}>
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
      </div>

      <button onClick={() => onApply(state)}>Aplicar filtros</button>
    </div>
  );
}
