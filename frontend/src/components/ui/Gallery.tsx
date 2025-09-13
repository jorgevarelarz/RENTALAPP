import React, { useState } from 'react';
import { toAbsoluteUrl } from '../../utils/media';

const Gallery: React.FC<{ photos?: string[] }>= ({ photos }) => {
  const imgs = (photos || []).filter(Boolean);
  const [i, setI] = useState(0);
  if (imgs.length === 0) return (
    <div style={{ height: 320, background: '#f5f5f5', borderRadius: 12, border: '1px solid var(--border)', display: 'grid', placeItems: 'center', color: '#888' }}>
      Sin foto
    </div>
  );
  const current = imgs[Math.max(0, Math.min(i, imgs.length - 1))];
  return (
    <div>
      <div style={{ height: 320, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <img src={toAbsoluteUrl(current)} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      {imgs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, overflowX: 'auto' }}>
          {imgs.map((src, idx) => (
            <button key={src+idx} onClick={() => setI(idx)} style={{ border: idx===i? '2px solid var(--primary)' : '1px solid var(--border)', borderRadius: 8, padding: 0, background: 'transparent' }}>
              <img src={toAbsoluteUrl(src)} alt={`thumb-${idx}`} style={{ width: 64, height: 48, objectFit: 'cover', display: 'block', borderRadius: 6 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Gallery;
