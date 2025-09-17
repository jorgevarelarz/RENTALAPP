import React, { useEffect } from 'react';
import styles from './Drawer.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  side?: 'left'|'right';
  children: React.ReactNode;
  width?: number;
};

const Drawer: React.FC<Props> = ({ open, onClose, side='left', children, width=360 }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    // Prevent background scroll when open
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);
  const borderStyle = side === 'right' ? { borderLeft: '1px solid var(--border)', borderRight: 'none' } : { borderRight: '1px solid var(--border)', borderLeft: 'none' };
  const shadowStyle = side === 'right' ? { boxShadow: '-12px 0 24px rgba(0,0,0,.08)' } : { boxShadow: '12px 0 24px rgba(0,0,0,.08)' };
  return (
    <>
      {open && <div className={styles.backdrop} onClick={onClose} />}
      <div
        className={styles.panel}
        style={{
          width: `min(${width}px, 92vw)`,
          transform: open ? 'translateX(0)' : side==='left' ? 'translateX(-100%)' : 'translateX(100%)',
          left: side==='left' ? 0 : undefined,
          right: side==='right' ? 0 : undefined,
          zIndex: 100,
          ...borderStyle,
          ...shadowStyle,
        }}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </>
  );
};

export default Drawer;
