import React from 'react';

interface Props {
  open: boolean;
  title?: string;
  reasons: string[];
  selected: string;
  comment: string;
  onChangeReason: (value: string) => void;
  onChangeComment: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ReasonModal({ open, title = 'Selecciona un motivo', reasons, selected, comment, onChangeReason, onChangeComment, onClose, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div style={backdropStyle}>
      <div style={modalStyle} role="dialog" aria-modal="true">
        <header style={{ marginBottom: 12 }}>
          <h2 style={{ margin: '0 0 4px' }}>{title}</h2>
          <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>Selecciona un motivo habitual y añade un comentario si lo necesitas.</p>
        </header>
        <div style={{ display: 'grid', gap: 8 }}>
          <select value={selected} onChange={e => onChangeReason(e.target.value)} style={selectStyle}>
            <option value="">– Selecciona motivo –</option>
            {reasons.map(reason => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
            <option value="__custom__">Otro motivo…</option>
          </select>
          <textarea
            placeholder="Comentario adicional (opcional)"
            style={textareaStyle}
            rows={3}
            value={comment}
            onChange={e => onChangeComment(e.target.value)}
          />
        </div>
        <footer style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 8 }}>
          <button type="button" onClick={onClose} style={btnGhost}>Cancelar</button>
          <button type="button" onClick={onConfirm} style={btnPrimary}>Confirmar</button>
        </footer>
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
};

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 20,
  width: 'min(480px, 92vw)',
  boxShadow: '0 20px 45px rgba(15,23,42,0.25)',
};

const selectStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid #d1d5db',
  padding: '8px 10px',
};

const textareaStyle: React.CSSProperties = {
  borderRadius: 8,
  border: '1px solid #d1d5db',
  padding: '8px 10px',
  fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
  background: '#dc2626',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 12px',
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  background: '#fff',
  color: '#111827',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  padding: '8px 12px',
  cursor: 'pointer',
};
