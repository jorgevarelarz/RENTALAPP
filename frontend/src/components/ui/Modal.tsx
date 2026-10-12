import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

const Modal: React.FC<ModalProps>
  = ({ open, onClose, title, children, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // onClose suele ser una función nueva en cada render: si fuera dependencia del efecto,
  // el foco volvería al primer botón cada vez que el padre se pinta
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    // Cerrado no bloquea el scroll ni escucha el teclado (muchas páginas lo dejan montado)
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key === 'Tab') {
        const root = containerRef.current; if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    };
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    setTimeout(() => {
      const root = containerRef.current; if (!root) return;
      // Primero el contenido (el campo o la acción principal); «Cerrar» solo si no hay otra cosa
      const focusable =
        root.querySelector<HTMLElement>(
          ['button', '[href]', 'input', 'select', 'textarea', '[tabindex]'].map(sel => `.ra-modal-body ${sel}`).join(', ')
        ) ||
        root.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]');
      focusable?.focus();
    }, 0);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = bodyOverflow; };
  }, [open]);

  if (!open) return null;
  // className va al panel: las utilidades de Tailwind (max-w-6xl, h-[85vh]…) pisan el ancho por defecto
  return (
    <div className="ra-modal" onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Ventana'}
        onClick={e => e.stopPropagation()}
        className={['ra-modal-panel', className].filter(Boolean).join(' ')}
      >
        <div className="ra-modal-head">
          {title && <h2 id={titleId} className="ra-modal-title">{title}</h2>}
          <button type="button" onClick={onClose} className="ra-modal-close" aria-label="Cerrar">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="ra-modal-body">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
