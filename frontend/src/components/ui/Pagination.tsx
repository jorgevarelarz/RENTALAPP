import React from 'react';

type Props = {
  page: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
};

const Pagination: React.FC<Props> = ({ page, total, pageSize, onPage }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const prev = () => onPage(Math.max(1, page - 1));
  const next = () => onPage(Math.min(pages, page + 1));
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
      <button onClick={prev} disabled={page <= 1} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--fg)', cursor: page<=1?'default':'pointer' }}>Anterior</button>
      <span style={{ fontSize: 12, opacity: .8 }}>Página {page} de {pages}</span>
      <button onClick={next} disabled={page >= pages} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--fg)', cursor: page>=pages?'default':'pointer' }}>Siguiente</button>
    </div>
  );
};

export default Pagination;

