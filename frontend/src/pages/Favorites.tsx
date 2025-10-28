import React, { useEffect, useMemo, useState } from 'react';
import { getFavorites, toggleFavorite, isFavorite } from '../utils/favorites';
import { toAbsoluteUrl } from '../utils/media';
import { listProperties } from '../api/properties';
import { Link } from 'react-router-dom';

const Favorites: React.FC = () => {
  const [all, setAll] = useState<any[]>([]);
  const favs = useMemo(() => getFavorites(), []);
  useEffect(() => { listProperties().then(setAll); }, []);
  const items = all.filter(p => favs.includes(String(p._id)));
  return (
    <div>
      <h2>Favoritos</h2>
      {items.length === 0 ? <p>No tienes favoritos aún.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {items.map((p:any) => (
            <div key={p._id} style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
              <div style={{ height: 140, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                {p.photos?.[0] ? <img src={toAbsoluteUrl(p.photos[0])} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Sin foto'}
              </div>
              <div style={{ padding: 12 }}>
                <h3 style={{ margin: '4px 0 8px' }}>{p.title}</h3>
                <div style={{ opacity: 0.8, fontSize: 14 }}>{p.address}</div>
                <div style={{ marginTop: 8, fontWeight: 700 }}>€{p.price}</div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Link to={`/p/${p._id}`}>Ver detalle</Link>
                  <button aria-label="favorito" onClick={() => { toggleFavorite(String(p._id)); window.location.reload(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
                    {isFavorite(String(p._id)) ? '❤' : '♡'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
