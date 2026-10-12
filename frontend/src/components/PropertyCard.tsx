import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ImageOff } from 'lucide-react';
import { toAbsoluteUrl } from '../utils/media';
import { formatRent, propertyFacts } from '../utils/propertyDetail';
import type { Property } from '../types/property';

type Props = {
  p: Property;
  onFavToggle?: (id: string, liked: boolean) => void;
};

export default function PropertyCard({ p, onFavToggle }: Props) {
  const photo = p.images?.[0];
  const liked = !!p._liked;
  const facts = propertyFacts(p);
  const href = `/properties/${p._id}`;

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[var(--ra-line)] bg-gray-100">
        <Link to={href} tabIndex={-1} aria-hidden="true">
          {photo ? (
            <img
              src={toAbsoluteUrl(photo)}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-gray-500">
              <ImageOff size={22} className="text-gray-400" aria-hidden="true" />
              Sin fotos todavía
            </span>
          )}
        </Link>

        {p.onlyTenantPro && (
          <span className="absolute left-3 top-3 rounded-md bg-white px-2 py-1 text-xs font-semibold text-gray-900 shadow-sm">
            Solo Tenant PRO
          </span>
        )}

        {onFavToggle && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onFavToggle(p._id, liked); }}
            aria-label={liked ? 'Quitar de guardados' : 'Guardar'}
            aria-pressed={liked}
            className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-gray-700 shadow-sm transition hover:bg-white hover:text-gray-950"
          >
            <Heart size={18} className={liked ? 'fill-[var(--ra-blue)] text-[var(--ra-blue)]' : ''} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <p className="truncate text-sm text-gray-500">{p.city}</p>
        <h3 className="mt-0.5 line-clamp-1 font-semibold text-gray-950 [overflow-wrap:anywhere]">
          <Link to={href} className="hover:underline">
            {p.title}
          </Link>
        </h3>
        {facts.length > 0 && <p className="mt-1 text-sm text-gray-600">{facts.join(' · ')}</p>}
        <p className="mt-2 text-gray-950">
          <span className="font-semibold">{formatRent(p.price)}</span>
          <span className="text-sm text-gray-500"> /mes</span>
        </p>
      </div>
    </article>
  );
}
