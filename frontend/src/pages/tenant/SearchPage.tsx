import React, { useEffect, useState } from 'react';
import { searchProperties } from '../../api/properties';

type SearchResult = {
  id: string;
  title: string;
  city?: string;
  price?: number;
  onlyTenantPro?: boolean;
};

const TenantSearchPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [onlyPro, setOnlyPro] = useState(false);
  const [items, setItems] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await searchProperties({ city: query || undefined, onlyTenantPro: onlyPro || undefined, limit: 30 });
        if (!active) return;
        const mapped = (response?.items ?? []).map((item: any) => ({
          id: String(item?._id || item?.id),
          title: String(item?.title || 'Propiedad'),
          city: item?.city ? String(item.city) : undefined,
          price: typeof item?.price === 'number' ? item.price : undefined,
          onlyTenantPro: !!item?.onlyTenantPro,
        }));
        setItems(mapped);
      } catch (err: any) {
        if (!active) return;
        const message = err?.response?.data?.error || err?.message || 'No se pudieron cargar las propiedades.';
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timeout = setTimeout(load, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query, onlyPro]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Buscar vivienda</h1>
        <p style={{ margin: 0, color: '#475569' }}>Aplica filtros y descubre viviendas Only PRO según tu solvencia.</p>
      </header>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input
          placeholder="Ciudad"
          value={query}
          onChange={event => setQuery(event.target.value)}
          style={inputStyle}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={onlyPro} onChange={event => setOnlyPro(event.target.checked)} />
          Solo PRO
        </label>
      </div>

      {loading && <div style={infoBoxStyle}>Buscando propiedades…</div>}
      {error && <div style={{ ...infoBoxStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      <section style={{ display: 'grid', gap: 12 }}>
        {items.map(property => (
          <article key={property.id} style={propertyCardStyle}>
            <div>
              <h2 style={{ margin: '0 0 4px' }}>{property.title}</h2>
              <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>{property.city ?? 'Ubicación no especificada'}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <strong>{property.price !== undefined ? `${property.price.toLocaleString('es-ES')} €` : 'Consultar'}</strong>
              {property.onlyTenantPro && <span style={badgeStyle}>Solo PRO</span>}
            </div>
          </article>
        ))}
        {items.length === 0 && !loading && <p>No se han encontrado resultados con los filtros aplicados.</p>}
      </section>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  border: '1px solid #cbd5f5',
  borderRadius: 10,
  padding: '10px 12px',
  maxWidth: 240,
};

const infoBoxStyle: React.CSSProperties = {
  border: '1px solid #cbd5f5',
  background: '#eef2ff',
  color: '#3730a3',
  borderRadius: 12,
  padding: '10px 14px',
};

const propertyCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 16,
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const badgeStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 6px',
  borderRadius: 6,
  background: '#eef2ff',
  border: '1px solid #cbd5f5',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
};

export default TenantSearchPage;
