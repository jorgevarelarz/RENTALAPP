import React, { useState } from 'react';
import PropertyCard from '../../components/PropertyCard';

export default function FavoritesPage() {
  const [items, setItems] = useState<any[]>([]);

  const onFavToggle = (id: string, liked: boolean) => {
    if (!liked) {
      setItems(array => array.filter(item => item._id !== id));
    }
  };

  return (
    <div style={{ padding: '24px', display: 'grid', gap: 12 }}>
      <h2>Mis favoritos</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {items.map(property => (
          <PropertyCard key={property._id} p={property} onFavToggle={onFavToggle} />
        ))}
        {!items.length && <div>No tienes favoritos aún.</div>}
      </div>
    </div>
  );
}
