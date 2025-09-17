import React, { useEffect, useState } from 'react';
import PropertyFilters from '../../components/PropertyFilters';
import PropertyCard from '../../components/PropertyCard';
import { favoriteProperty, searchProperties, unfavoriteProperty } from '../../services/properties';

type SearchResponse = {
  items: any[];
  page: number;
  limit: number;
  total: number;
};

export default function PropertiesList() {
  const [params, setParams] = useState<any>({ limit: 12, sort: 'createdAt', dir: 'desc' });
  const [data, setData] = useState<SearchResponse>({ items: [], page: 1, limit: 12, total: 0 });
  const [loading, setLoading] = useState(false);

  const load = async (override?: any) => {
    setLoading(true);
    const res = await searchProperties({ ...params, ...override });
    setData(res);
    setParams((prev: any) => ({ ...prev, ...override, page: res.page }));
    setLoading(false);
  };

  useEffect(() => {
    load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onApplyFilters = (filters: any) => load({ ...filters, page: 1 });

  const onFavToggle = async (id: string, liked: boolean) => {
    try {
      const fn = liked ? favoriteProperty : unfavoriteProperty;
      await fn(id);
      setData(current => ({
        ...current,
        items: current.items.map(item =>
          item._id === id
            ? { ...item, _liked: liked, favoritesCount: (item.favoritesCount || 0) + (liked ? 1 : -1) }
            : item
        ),
      }));
    } catch (error) {
      // ignore
    }
  };

  const pages = Math.ceil((data.total || 0) / (data.limit || 1)) || 1;

  return (
    <div style={{ padding: '24px', display: 'grid', gap: 16 }}>
      <h2>Propiedades</h2>
      <PropertyFilters initial={params} onApply={onApplyFilters} />
      {loading && <div>Cargando…</div>}
      {!loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {data.items.map(property => (
              <PropertyCard key={property._id} p={property} onFavToggle={onFavToggle} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            <button disabled={data.page <= 1} onClick={() => load({ page: data.page - 1 })}>
              Anterior
            </button>
            <span>
              Página {data.page} / {pages}
            </span>
            <button disabled={data.page >= pages} onClick={() => load({ page: data.page + 1 })}>
              Siguiente
            </button>
          </div>
        </>
      )}
    </div>
  );
}
