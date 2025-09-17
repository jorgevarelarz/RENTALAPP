import React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  p: any;
  onFavToggle?: (id: string, liked: boolean) => void;
};

export default function PropertyCard({ p, onFavToggle }: Props) {
  const image = p.images?.[0] || 'https://via.placeholder.com/600x400?text=Property';
  const liked = !!p._liked;

  return (
    <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
      <Link to={`/properties/${p._id}`} style={{ display: 'block' }}>
        <img src={image} alt={p.title} style={{ width: '100%', height: 180, objectFit: 'cover' }} />
      </Link>
      <div style={{ padding: 12, display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{p.price} €</strong>
          {onFavToggle && (
            <button
              onClick={() => onFavToggle(p._id, !liked)}
              aria-label="fav"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {liked ? '❤️' : '🤍'}
            </button>
          )}
        </div>
        <div style={{ color: '#444' }}>{p.title}</div>
        <small style={{ color: '#777' }}>
          {p.city} · {p.rooms} hab · {p.sizeM2 || '—'} m²
        </small>
      </div>
    </div>
  );
}
