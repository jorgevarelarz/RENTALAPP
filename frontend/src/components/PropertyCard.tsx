import React from 'react';
import { Link } from 'react-router-dom';

type Props = {
  p: any;
  onFavToggle?: (id: string, liked: boolean) => void;
};

export default function PropertyCard({ p, onFavToggle }: Props) {
  const image = p.images?.[0] || 'https://via.placeholder.com/1000x600?text=Property';
  const liked = !!p._liked;
  const onlyPro = !!p.onlyTenantPro;
  return (
    <article className="rounded-lg border border-gray-200 overflow-hidden shadow-sm bg-white" aria-label={p.title}>
      <Link to={`/properties/${p._id}`} className="block aspect-video bg-gray-100">
        <img src={image} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
      </Link>
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-2xl font-semibold text-gray-900">{(p.price || 0).toLocaleString()} €</div>
            {onlyPro && (
              <span className="inline-flex items-center rounded-full border border-gray-900 px-2 py-0.5 text-xs font-medium" title="Esta propiedad requiere Tenant PRO (solvencia verificada)">
                Solo inquilinos PRO
              </span>
            )}
          </div>
          {onFavToggle && (
            <button
              onClick={() => onFavToggle(p._id, !liked)}
              aria-label="Favorito"
              className="text-xl"
              title={liked ? 'Quitar de favoritos' : 'Añadir a favoritos'}
            >
              {liked ? '❤️' : '🤍'}
            </button>
          )}
        </div>
        <h3 className="text-gray-900 font-medium line-clamp-1">{p.title}</h3>
        <p className="text-sm text-gray-600">{p.city} · {p.rooms} hab · {p.sizeM2 || '—'} m²</p>
        <div className="mt-1">
          <Link to={`/properties/${p._id}`} className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
            Ver detalle
          </Link>
        </div>
      </div>
    </article>
  );
}
