import React, { useState } from 'react';
import { toAbsoluteUrl } from '../../utils/media';
import styles from './Gallery.module.css';

const Gallery: React.FC<{ photos?: string[] }>= ({ photos }) => {
  const imgs = (photos || []).filter(Boolean);
  const [i, setI] = useState(0);
  if (imgs.length === 0) return (
    <div className={styles.empty}>Sin foto</div>
  );
  const current = imgs[Math.max(0, Math.min(i, imgs.length - 1))];
  return (
    <div>
      <div className={styles.main}>
        <img src={toAbsoluteUrl(current)} alt="foto" className={styles.image} />
      </div>
      {imgs.length > 1 && (
        <div className={styles.thumbs}>
          {imgs.map((src, idx) => (
            <button
              key={src+idx}
              onClick={() => setI(idx)}
              className={`${styles.thumbButton}${idx===i ? ` ${styles.thumbButtonActive}` : ''}`}
            >
              <img src={toAbsoluteUrl(src)} alt={`thumb-${idx}`} className={styles.thumbImage} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Gallery;
