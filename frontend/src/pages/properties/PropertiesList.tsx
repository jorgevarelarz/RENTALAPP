import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PropertyCard from '../../components/PropertyCard';
import { favoriteProperty, listMyFavorites, unfavoriteProperty } from '../../services/properties';
import FilterBar from '../../components/FilterBar';
import SkeletonGrid from '../../components/ui/SkeletonGrid';
import { usePropertyFilters, usePropertiesQuery } from '../../hooks/useProperties';
import Drawer from '../../components/ui/Drawer';
import LoginPrompt from '../../components/LoginPrompt';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import EmptyState from '../../components/ui/EmptyState';
import ErrorCard from '../../components/ui/ErrorCard';
import type { Property } from '../../types/property';

const secondaryButton =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[var(--ra-line)] bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';

// Filtros que el usuario ha elegido (la página, el tamaño y el orden no cuentan)
const FILTER_KEYS = ['q', 'region', 'city', 'priceMin', 'priceMax', 'roomsMin', 'roomsMax', 'bathMin', 'furnished', 'petsAllowed', 'onlyTenantPro'] as const;

export const hasActiveFilters = (filters: Record<string, unknown>) =>
  FILTER_KEYS.some((k) => {
    const v = filters[k];
    return v !== undefined && v !== null && v !== '' && v !== false;
  });

export const listingCountLabel = (n: number) =>
  n === 1 ? '1 vivienda disponible' : `${n.toLocaleString('es-ES')} viviendas disponibles`;

export default function PropertiesList() {
  const { filters, setFilters, clearFilters } = usePropertyFilters();
  const { data, isLoading, isFetching, error, refetch } = usePropertiesQuery(filters);
  const { search } = useLocation();
  const [showFilters, setShowFilters] = useState(false);
  const [promptLogin, setPromptLogin] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const toast = useToast();

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

  const setLiked = (id: string, liked: boolean) =>
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (liked) next.add(id);
      else next.delete(id);
      return next;
    });

  const onFavToggle = async (id: string, liked: boolean) => {
    if (!user) { setPromptLogin(true); return; }
    setLiked(id, !liked);
    try {
      if (liked) await unfavoriteProperty(id);
      else await favoriteProperty(id);
    } catch {
      setLiked(id, liked);
      toast.push({ title: 'No se pudo actualizar tus guardados', tone: 'error' });
    }
  };

  const items = useMemo(() => {
    // El servidor ya filtra (también onlyTenantPro); filtrar aquí descuadraba el recuento y la paginación.
    return (data?.items || []).map((it): Property => ({
      ...it,
      _liked: likedIds.has(String(it._id)),
    }));
  }, [data, likedIds]);
  const page = data?.page || 1;
  const limit = data?.limit || filters.limit || 12;
  const total = data?.total || 0;
  const pages = Math.ceil((total || 0) / (limit || 1)) || 1;
  const filtered = hasActiveFilters(filters as Record<string, unknown>);

  const clear = () => {
    clearFilters();
    setShowFilters(false);
  };

  return (
    <div className="grid gap-6 pb-10">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Viviendas en alquiler</h1>
          <p className="mt-1 text-sm text-gray-500" aria-live="polite">
            {isLoading
              ? 'Buscando viviendas…'
              : total > 0
                ? listingCountLabel(total)
                : 'Encuentra tu próxima vivienda'}
            {isFetching && !isLoading ? ' · actualizando…' : ''}
          </p>
        </div>
        <button type="button" className={`${secondaryButton} md:hidden`} onClick={() => setShowFilters(true)}>
          Filtros
        </button>
      </div>
      {/* Filtros fijos en escritorio; la key los vuelve a leer de la URL cuando cambia */}
      <div className="sticky top-14 z-10 hidden md:block">
        <FilterBar
          key={search}
          initial={filters}
          onApply={(next) => setFilters({ ...next, page: 1 })}
          onClear={clear}
        />
      </div>
      {isLoading ? (
        <SkeletonGrid />
      ) : error ? (
        <ErrorCard
          message="No se pudo cargar el listado. Comprueba tu conexión e inténtalo de nuevo."
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No hay viviendas con esos filtros"
            detail="Prueba con otra zona o un precio más amplio, o borra los filtros para ver todas."
            cta={<button type="button" className={secondaryButton} onClick={clear}>Borrar filtros</button>}
          />
        ) : (
          <EmptyState
            title="Todavía no hay viviendas publicadas"
            detail="Vuelve en unos días: los anuncios nuevos aparecen aquí en cuanto se publican."
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((property) => (
              <PropertyCard key={property._id} p={property} onFavToggle={onFavToggle} />
            ))}
          </div>
          {pages > 1 && (
            <nav className="mt-2 flex items-center justify-center gap-3" aria-label="Paginación">
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setFilters({ page: Math.max(1, page - 1) })}
                disabled={page <= 1}
              >Anterior</button>
              <span className="text-sm tabular-nums text-gray-500">Página {page} de {pages}</span>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setFilters({ page: Math.min(pages, page + 1) })}
                disabled={page >= pages}
              >Siguiente</button>
            </nav>
          )}
        </>
      )}

      {/* Drawer móvil para filtros */}
      <Drawer open={showFilters} onClose={() => setShowFilters(false)} side="right">
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
            <button type="button" className={secondaryButton} onClick={() => setShowFilters(false)}>Cerrar</button>
          </div>
          <FilterBar
            key={search}
            initial={filters}
            onApply={(next) => { setFilters({ ...next, page: 1 }); setShowFilters(false); }}
            onClear={clear}
          />
        </div>
      </Drawer>
      <LoginPrompt open={promptLogin} reason="save" onClose={() => setPromptLogin(false)} />
    </div>
  );
}
