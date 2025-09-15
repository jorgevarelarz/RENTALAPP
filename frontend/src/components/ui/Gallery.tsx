import React, { useState } from 'react';
import { toAbsoluteUrl } from '../../utils/media';

const Gallery: React.FC<{ photos?: string[] }>= ({ photos }) => {
  const imgs = (photos || []).filter(Boolean);
  const [i, setI] = useState(0);
  if (imgs.length === 0) return (
    <div className="gallery-empty">Sin foto</div>
  );
  const current = imgs[Math.max(0, Math.min(i, imgs.length - 1))];
  return (
    <div>
      <div className="gallery-main">
        <img src={toAbsoluteUrl(current)} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      {imgs.length > 1 && (
        <div className="gallery-thumbs">
          {imgs.map((src, idx) => (
            <button key={src+idx} onClick={() => setI(idx)} className={`thumb-btn${idx===i?' active':''}`}>
              <img src={toAbsoluteUrl(src)} alt={`thumb-${idx}`} style={{ width: 64, height: 48, objectFit: 'cover', display: 'block', borderRadius: 6 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Gallery;
