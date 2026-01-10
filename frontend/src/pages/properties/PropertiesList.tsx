import React, { useEffect, useMemo, useState } from 'react';
import PropertyCard from '../../components/PropertyCard';
import { favoriteProperty, listMyFavorites, unfavoriteProperty } from '../../services/properties';
import FilterBar from '../../components/FilterBar';
import SkeletonGrid from '../../components/ui/SkeletonGrid';
import { usePropertyFilters, usePropertiesQuery } from '../../hooks/useProperties';
import Drawer from '../../components/ui/Drawer';
import LoginPrompt from '../../components/LoginPrompt';
import { useAuth } from '../../context/AuthContext';
import EmptyState from '../../components/ui/EmptyState';
import ErrorCard from '../../components/ui/ErrorCard';

export default function PropertiesList() {
  const { filters, setFilters } = usePropertyFilters();
  const { data, isLoading, isFetching } = usePropertiesQuery(filters);
  const [showFilters, setShowFilters] = useState(false);
  const [promptLogin, setPromptLogin] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  // filtros se aplican inline en FilterBar: no necesitamos handler aparte

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) { setLikedIds(new Set()); return; }
      try {
        const res = await listMyFavorites();
        if (!mounted) return;
        const next = new Set((res.items || []).map((p: any) => String(p._id)));
        setLikedIds(next);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [user]);

  const onFavToggle = async (id: string, liked: boolean) => {
    if (!user) { setPromptLogin(true); return; }
    try {
      const fn = liked ? unfavoriteProperty : favoriteProperty;
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (!liked) next.add(id);
        else next.delete(id);
        return next;
      });
      await fn(id);
    } catch {}
  };

  const items = useMemo(() => {
    const raw = ((data?.items as any[]) || []);
    const filtered = raw.filter((it: any) => (filters as any).onlyTenantPro ? !!it.onlyTenantPro : true);
    return filtered.map((it: any) => ({
      ...it,
      _liked: likedIds.has(String(it._id)) || !!it._liked,
    }));
  }, [data, filters, likedIds]);
  const page = (data as any)?.page || 1;
  const limit = (data as any)?.limit || filters.limit || 12;
  const total = (data as any)?.total || 0;
  const pages = Math.ceil((total || 0) / (limit || 1)) || 1;

  return (
    <div style={{ padding: '24px', display: 'grid', gap: 16 }}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Propiedades</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50 md:hidden"
            onClick={() => setShowFilters(true)}
          >
            Filtros
          </button>
          <div className="text-sm text-gray-600">{isFetching ? 'Actualizando…' : null}</div>
        </div>
      </div>
      {/* Filtros sticky en desktop */}
      <div className="hidden md:block sticky top-14 z-10">
        <FilterBar initial={filters} onApply={(next) => { setFilters({ ...next, page: 1 }); }} />
      </div>
      {isLoading ? (
        <SkeletonGrid />
      ) : (data as any)?.error ? (
        <ErrorCard message={(data as any)?.error || 'No se pudo cargar el listado'} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No encontramos propiedades con esos filtros"
          detail="Ajusta los criterios o borra los filtros para ver más resultados."
          cta={<button className="px-3 py-1.5 rounded border border-gray-300" onClick={() => setFilters({})}>Borrar filtros</button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {items.map((property: any) => (
              <PropertyCard key={property._id} p={property} onFavToggle={onFavToggle} />
            ))}
          </div>
          <nav className="flex items-center justify-center gap-2 mt-3" aria-label="Paginación">
            <button
              className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50"
              onClick={() => setFilters({ page: Math.max(1, page - 1) })}
              disabled={page <= 1}
            >Anterior</button>
            <span className="text-sm text-gray-700">Página {page} / {pages}</span>
            <button
              className="px-3 py-1.5 rounded border border-gray-300 disabled:opacity-50"
              onClick={() => setFilters({ page: Math.min(pages, page + 1) })}
              disabled={page >= pages}
            >Siguiente</button>
          </nav>
        </>
      )}

      {/* Drawer móvil para filtros */}
      <Drawer open={showFilters} onClose={() => setShowFilters(false)} side="right">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Filtros</h3>
            <button className="px-3 py-1.5 rounded border border-gray-300" onClick={() => setShowFilters(false)}>Cerrar</button>
          </div>
          <FilterBar initial={filters} onApply={(next) => { setFilters({ ...next, page: 1 }); setShowFilters(false); }} />
        </div>
      </Drawer>
      <LoginPrompt open={promptLogin} onClose={() => setPromptLogin(false)} />
    </div>
  );
}
