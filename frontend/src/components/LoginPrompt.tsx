import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Modal from './ui/Modal';

export default function LoginPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loc = useLocation();
  const redirect = encodeURIComponent(loc.pathname + loc.search);
  return (
    <Modal open={open} onClose={onClose} title="Inicia sesión">
      <div style={{ display: 'grid', gap: 10 }}>
        <p>Para usar esta función debes iniciar sesión.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to={`/login?redirect=${redirect}`}
            onClick={onClose}
            style={{ border: '1px solid #d4d4d8', padding: '8px 12px', borderRadius: 8 }}
          >
            Ir a iniciar sesión
          </Link>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d4d4d8' }}>Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}

