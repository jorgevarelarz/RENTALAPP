import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { favoriteProperty, getProperty, incrementView, unfavoriteProperty } from '../../services/properties';
import TenantProPanel from '../../components/TenantProPanel';
import { useAuth } from '../../context/AuthContext';

export default function PropertyDetail() {
  const { id } = useParams();
  const [property, setProperty] = useState<any>(null);
  const [liked, setLiked] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      if (!id) return;
      const detail = await getProperty(id);
      setProperty(detail);
      await incrementView(id);
    })();
  }, [id]);

  const toggleFavorite = async () => {
    if (!property?._id) return;
    if (liked) {
      await unfavoriteProperty(property._id);
    } else {
      await favoriteProperty(property._id);
    }
    setLiked(!liked);
  };

  if (!property) {
    return <div style={{ padding: 24 }}>Cargando…</div>;
  }

  const images = property.images?.length ? property.images : ['https://via.placeholder.com/1000x600?text=Property'];
  const requiredRent = property.onlyTenantPro ? property.requiredTenantProMaxRent || property.price : undefined;
  const tenantBadge = property.onlyTenantPro ? (
    <div
      style={{
        background: '#dbeafe',
        color: '#1d4ed8',
        padding: '6px 12px',
        borderRadius: 999,
        fontWeight: 600,
        display: 'inline-block',
      }}
    >
      Solo inquilinos PRO · mínimo {requiredRent} €/mes
    </div>
  ) : null;

  return (
    <div style={{ padding: '24px', display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
      <h2>{property.title}</h2>
      {tenantBadge}
      <div style={{ display: 'grid', gap: 8 }}>
        <img
          src={images[0]}
          alt={property.title}
          style={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 10 }}
        />
        {images.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {images.slice(1).map((src: string, index: number) => (
              <img key={index} src={src} alt={`${property.title}-${index}`} style={{ height: 90, borderRadius: 6 }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{property.price} € / mes</div>
          <div style={{ color: '#666' }}>
            {property.city} · {property.rooms} hab · {property.bathrooms} baños · {property.sizeM2 || '—'} m²
          </div>
        </div>
        <button onClick={toggleFavorite}>{liked ? '❤️ Quitar de favoritos' : '🤍 Añadir a favoritos'}</button>
      </div>

      {user?.role === 'tenant' && (
        <TenantProPanel requiredRent={requiredRent} />
      )}

      <div>
        <h3>Descripción</h3>
        <p>{property.description || 'Sin descripción.'}</p>
      </div>

      <div>
        <h3>Características</h3>
        <ul>
          <li>Mascotas: {property.petsAllowed ? 'Sí' : 'No'}</li>
          <li>Amueblado: {property.furnished ? 'Sí' : 'No'}</li>
          <li>
            Disponible desde: {property.availableFrom ? new Date(property.availableFrom).toLocaleDateString() : '—'}
          </li>
        </ul>
      </div>
    </div>
  );
}
