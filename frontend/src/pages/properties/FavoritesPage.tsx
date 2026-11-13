import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import PropertyCard from '../../components/PropertyCard';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import SkeletonGrid from '../../components/ui/SkeletonGrid';
import { favoriteProperty, listMyFavorites, unfavoriteProperty } from '../../services/properties';
import { formatApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { Property } from '../../types/property';

const secondaryLink =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50';
const textButton =
  'whitespace-nowrap font-semibold text-[var(--ra-blue)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ra-blue)] disabled:opacity-60';

export const savedCountLabel = (n: number) => (n === 1 ? '1 piso guardado' : `${n.toLocaleString('es-ES')} pisos guardados`);

type Removed = { property: Property; index: number };

export default function FavoritesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [undoing, setUndoing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await listMyFavorites();
      setItems(res.items || []);
    } catch (e) {
      setLoadError(formatApiError(e, 'No se pudieron cargar tus favoritos'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const onFavToggle = async (id: string, liked: boolean) => {
    if (!liked) return;
    const index = items.findIndex((item) => item._id === id);
    if (index < 0) return;
    const property = items[index];
    setActionError(null);
    setRemoved(null);
    setItems((list) => list.filter((item) => item._id !== id));
    try {
      await unfavoriteProperty(id);
      setRemoved({ property, index });
    } catch (e) {
      setItems((list) => insertAt(list, property, index));
      setActionError(formatApiError(e, 'No se pudo quitar de favoritos. Inténtalo de nuevo.'));
    }
  };

  const undo = async () => {
    if (!removed) return;
    setUndoing(true);
    setActionError(null);
    try {
      await favoriteProperty(removed.property._id);
      setItems((list) => insertAt(list, removed.property, removed.index));
      setRemoved(null);
    } catch (e) {
      setActionError(formatApiError(e, 'No se pudo volver a guardar. Inténtalo de nuevo.'));
    } finally {
      setUndoing(false);
    }
  };

  const explore = <Link to="/properties" className={secondaryLink}>Buscar pisos</Link>;
  const empty = !loading && !loadError && items.length === 0;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Favoritos"
        subtitle={loading || loadError || empty ? 'Los pisos que guardas para compararlos y volver a ellos.' : savedCountLabel(items.length)}
        cta={empty ? undefined : explore}
      />

      {removed && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--ra-line)] bg-white px-4 py-3 text-sm text-gray-700">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            Has quitado «{removed.property.title || 'Vivienda'}» de favoritos.
          </span>
          <button type="button" onClick={undo} disabled={undoing} className={textButton}>
            Deshacer
          </button>
        </div>
      )}

      {(loadError || actionError) && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">{loadError || actionError}</span>
          {loadError && (
            <button type="button" onClick={load} className="whitespace-nowrap font-semibold underline">
              Reintentar
            </button>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonGrid count={3} />
      ) : empty ? (
        <EmptyState
          title="Aún no has guardado ningún piso"
          detail="Pulsa el corazón de un anuncio para guardarlo aquí. Si su propietario lo retira, dejará de aparecer."
          cta={explore}
        />
      ) : (
        !loadError && (
          <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((property) => (
              <PropertyCard key={property._id} p={property} onFavToggle={onFavToggle} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function insertAt(list: Property[], property: Property, index: number) {
  if (list.some((item) => item._id === property._id)) return list;
  const next = list.slice();
  next.splice(Math.min(index, next.length), 0, property);
  return next;
}
