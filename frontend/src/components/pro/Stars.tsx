import React from 'react';
import { Star } from 'lucide-react';

/** Nota de 1 a 5 en estrellas, solo para ver; el texto accesible dice la nota. */
export default function Stars({ score, size = 14 }: { score: number; size?: number }) {
  const full = Math.round(Number(score) || 0);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${full} de 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={size}
          aria-hidden="true"
          className={n <= full ? 'fill-gray-900 text-gray-900' : 'fill-gray-200 text-gray-200'}
        />
      ))}
    </span>
  );
}
