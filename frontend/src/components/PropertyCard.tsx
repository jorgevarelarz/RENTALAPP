import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, BedDouble, Bath, Ruler, Heart } from 'lucide-react';

type Props = {
  p: any;
  onFavToggle?: (id: string, liked: boolean) => void;
};

export default function PropertyCard({ p, onFavToggle }: Props) {
  const image = p.images?.[0] || 'https://via.placeholder.com/1000x600?text=Sin+Foto';
  const liked = !!p._liked;

  return (
    <article className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Link to={`/properties/${p._id}`}>
          <img
            src={image}
            alt={p.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </Link>

        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {p.onlyTenantPro && (
            <span className="bg-blue-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide shadow-sm">
              PRO
            </span>
          )}
          {p.status === 'rented' && (
            <span className="bg-gray-800/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide shadow-sm">
              Alquilado
            </span>
          )}
        </div>

        {onFavToggle && (
          <button
            onClick={(e) => { e.preventDefault(); onFavToggle(p._id, liked); }}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-red-500 transition-all shadow-sm backdrop-blur-sm"
          >
            <Heart size={18} className={liked ? "fill-red-500 text-red-500" : ""} />
          </button>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg text-gray-900 leading-tight group-hover:text-blue-600 transition-colors line-clamp-1">
            {p.title}
          </h3>
          <span className="font-bold text-lg text-blue-600 whitespace-nowrap">
            {p.price?.toLocaleString()} €
          </span>
        </div>

        <div className="flex items-center gap-1 text-gray-500 text-sm mb-4">
          <MapPin size={14} />
          <span className="truncate">{p.city} {p.region ? `, ${p.region}` : ''}</span>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600 mt-auto pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5" title="Habitaciones">
            <BedDouble size={16} className="text-gray-400" />
            <span>{p.rooms}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Baños">
            <Bath size={16} className="text-gray-400" />
            <span>{p.bathrooms}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Metros cuadrados">
            <Ruler size={16} className="text-gray-400" />
            <span>{p.sizeM2} m²</span>
          </div>
        </div>
      </div>
    </article>
  );
}
