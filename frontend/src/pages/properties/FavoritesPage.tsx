import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PropertyCard from '../../components/PropertyCard';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import { listMyFavorites, unfavoriteProperty } from '../../services/properties';
import { useAuth } from '../../context/AuthContext';

export default function FavoritesPage() {
  const [items, setItems] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        const res = await listMyFavorites();
        if (mounted) setItems(res.items || []);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [user]);

  const onFavToggle = async (id: string, liked: boolean) => {
    if (!liked) return;
    try {
      await unfavoriteProperty(id);
      setItems(array => array.filter(item => item._id !== id));
    } catch {}
  };

  return (
    <div style={{ padding: '24px', display: 'grid', gap: 12 }}>
      <PageHeader
        title="Favoritos"
        subtitle="Guarda pisos para revisarlos mas tarde."
        cta={(
          <Link to="/properties" className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Explorar pisos
          </Link>
        )}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {items.map(property => (
          <PropertyCard key={property._id} p={property} onFavToggle={onFavToggle} />
        ))}
        {!items.length && (
          <EmptyState
            title="No tienes favoritos aun"
            detail="Guarda tus pisos preferidos para compararlos despues."
            cta={(
              <Link to="/properties" className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Explorar pisos
              </Link>
            )}
          />
        )}
      </div>
    </div>
  );
}
