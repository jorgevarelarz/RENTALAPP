import React, { useEffect, useRef } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  side?: 'left'|'right';
  children: React.ReactNode;
  width?: number;
  label?: string;
};

const Drawer: React.FC<Props> = ({ open, onClose, side='left', children, width=360, label }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      // Panel modal: el Tab da la vuelta dentro del panel
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  useEffect(() => {
    // Lleva el foco al panel al abrir y lo devuelve a quien lo abrió al cerrar
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => { opener?.focus?.(); };
  }, [open]);
  useEffect(() => {
    // Prevent background scroll when open
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);
  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} />}
      <div
        ref={panelRef}
        className={`drawer-panel drawer-panel-${side}${open ? ' is-open' : ''}`}
        tabIndex={-1}
        style={{ width: `min(${width}px, 92vw)` }}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-hidden={!open}
      >
        {children}
      </div>
    </>
  );
};

export default Drawer;
