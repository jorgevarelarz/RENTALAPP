import React, { useEffect, useRef } from 'react';

const Modal: React.FC<{ open: boolean; onClose: () => void; title?: string; children: React.ReactNode }>
  = ({ open, onClose, title, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
    // move focus inside
    setTimeout(() => {
      const root = containerRef.current; if (!root) return;
      const focusable = root.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]');
      focusable?.focus();
    }, 0);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = bodyOverflow; };
  }, [onClose]);

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'grid', placeItems: 'center', zIndex: 50 }} onClick={onClose} role="dialog" aria-modal="true" aria-label={title || 'Modal'}>
      <div ref={containerRef} onClick={e => e.stopPropagation()} style={{ background: 'var(--card)', color: 'var(--fg)', width: 520, maxWidth: '90vw', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)', fontWeight: 700 }}>{title}</div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
