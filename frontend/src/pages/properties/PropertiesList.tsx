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
import type { Property } from '../../types/property';

export default function PropertiesList() {
  const { filters, setFilters } = usePropertyFilters();
  const { data, isLoading, isFetching, error } = usePropertiesQuery(filters);
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
        const next = new Set((res.items || []).map((p) => String(p._id)));
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
    const raw = data?.items || [];
    const filtered = raw.filter((it) => (filters as { onlyTenantPro?: boolean }).onlyTenantPro ? !!it.onlyTenantPro : true);
    return filtered.map((it): Property => ({
      ...it,
      _liked: likedIds.has(String(it._id)) || !!it._liked,
    }));
  }, [data, filters, likedIds]);
  const page = data?.page || 1;
  const limit = data?.limit || filters.limit || 12;
  const total = data?.total || 0;
  const pages = Math.ceil((total || 0) / (limit || 1)) || 1;

  return (
    <div className="py-2 grid gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-950">Propiedades</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {isLoading
              ? 'Buscando viviendas…'
              : total > 0
                ? `${total.toLocaleString()} ${total === 1 ? 'vivienda disponible' : 'viviendas disponibles'}`
                : 'Encuentra tu próxima vivienda'}
            {isFetching && !isLoading ? ' · actualizando…' : ''}
          </p>
        </div>
        <button
          type="button"
          className="px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 md:hidden"
          onClick={() => setShowFilters(true)}
        >
          Filtros
        </button>
      </div>
      {/* Filtros sticky en desktop */}
      <div className="hidden md:block sticky top-14 z-10">
        <FilterBar initial={filters} onApply={(next) => { setFilters({ ...next, page: 1 }); }} />
      </div>
      {isLoading ? (
        <SkeletonGrid />
      ) : error ? (
        <ErrorCard message={error.message || 'No se pudo cargar el listado'} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No encontramos propiedades con esos filtros"
          detail="Ajusta los criterios o borra los filtros para ver más resultados."
          cta={<button className="px-3 py-1.5 rounded border border-gray-300" onClick={() => setFilters({})}>Borrar filtros</button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {items.map((property) => (
              <PropertyCard key={property._id} p={property} onFavToggle={onFavToggle} />
            ))}
          </div>
          {pages > 1 && (
            <nav className="flex items-center justify-center gap-3 mt-4" aria-label="Paginación">
              <button
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setFilters({ page: Math.max(1, page - 1) })}
                disabled={page <= 1}
              >Anterior</button>
              <span className="text-sm text-gray-500 tabular-nums">Página {page} de {pages}</span>
              <button
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => setFilters({ page: Math.min(pages, page + 1) })}
                disabled={page >= pages}
              >Siguiente</button>
            </nav>
          )}
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
