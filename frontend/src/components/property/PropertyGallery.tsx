import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ImageOff, Images, X } from 'lucide-react';
import { toAbsoluteUrl } from '../../utils/media';

type Props = { photos: string[]; title: string };

/**
 * Foto principal y, en escritorio, dos más a la derecha; cada foto abre el visor.
 * Con menos fotos la rejilla se adapta en vez de repetir la misma imagen.
 */
export default function PropertyGallery({ photos, title }: Props) {
  const urls = photos.filter(Boolean).map((p) => toAbsoluteUrl(p));
  const [viewer, setViewer] = useState<number | null>(null);

  if (urls.length === 0) {
    return (
      <div className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--ra-line)] bg-white text-sm text-gray-500">
        <ImageOff size={28} className="text-gray-400" aria-hidden />
        Este anuncio todavía no tiene fotos
      </div>
    );
  }

  const side = urls.slice(1, 3);
  const photoButton = (src: string, index: number, className: string) => (
    <button
      key={src + index}
      type="button"
      onClick={() => setViewer(index)}
      className={`group relative block overflow-hidden bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ra-blue)] ${className}`}
      aria-label={`Ver la foto ${index + 1} de ${urls.length}`}
    >
      <img
        src={src}
        alt={index === 0 ? title : ''}
        className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-90"
        loading={index === 0 ? 'eager' : 'lazy'}
      />
    </button>
  );

  return (
    <>
      <div className="relative">
        <div
          className={`grid h-[260px] gap-2 overflow-hidden rounded-2xl sm:h-[360px] lg:h-[440px] ${
            side.length ? 'md:grid-cols-3 md:grid-rows-2' : ''
          }`}
        >
          {photoButton(urls[0], 0, side.length ? 'md:col-span-2 md:row-span-2' : '')}
          {side.map((src, i) =>
            photoButton(src, i + 1, `hidden md:block ${side.length === 1 ? 'md:row-span-2' : ''}`),
          )}
        </div>
        {urls.length > 1 && (
          <button
            type="button"
            onClick={() => setViewer(0)}
            className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full border border-[var(--ra-line)] bg-white px-3.5 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
          >
            <Images size={16} aria-hidden />
            Ver las {urls.length} fotos
          </button>
        )}
      </div>
      {viewer !== null && (
        <PhotoViewer urls={urls} title={title} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />
      )}
    </>
  );
}

function PhotoViewer({
  urls,
  title,
  index,
  onIndex,
  onClose,
}: {
  urls: string[];
  title: string;
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = urls.length;
  const go = useCallback((delta: number) => onIndex((index + delta + count) % count), [index, count, onIndex]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  const navButton = 'flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white';

  // En un portal: dentro del contenido con scroll de AppShell el fondo quedaba recortado
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${title}`}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(8, 16, 45, 0.96)' }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
        <span aria-live="polite">
          {index + 1} de {count}
        </span>
        <button ref={closeRef} type="button" onClick={onClose} className={navButton} aria-label="Cerrar">
          <X size={20} aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center gap-2 px-2 pb-6 sm:gap-4 sm:px-4">
        {count > 1 && (
          <button type="button" onClick={() => go(-1)} className={navButton} aria-label="Foto anterior">
            <ChevronLeft size={22} aria-hidden />
          </button>
        )}
        <div className="flex h-full min-w-0 flex-1 items-center justify-center">
          <img src={urls[index]} alt={`${title}, foto ${index + 1}`} className="h-full w-full object-contain" />
        </div>
        {count > 1 && (
          <button type="button" onClick={() => go(1)} className={navButton} aria-label="Foto siguiente">
            <ChevronRight size={22} aria-hidden />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
