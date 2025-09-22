import React from 'react';

export default function EmptyState({ title, detail, cta }: { title: string; detail?: string; cta?: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', border: '1px dashed #E5E7EB', padding: 20, borderRadius: 12, background: '#F9FAFB' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      {detail && <div style={{ color: '#6B7280', marginBottom: 10 }}>{detail}</div>}
      {cta}
    </div>
  );
}

