import React, { useEffect, useMemo, useRef, useState } from 'react';
import { listProperties } from '../services/properties';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { SkeletonCard } from '../components/ui/Skeleton';
import { isFavorite, toggleFavorite } from '../utils/favorites';
import { toAbsoluteUrl } from '../utils/media';
import Drawer from '../components/ui/Drawer';
import Badge from '../components/ui/Badge';
import { formatPriceEUR, isNew } from '../utils/format';
import pageStyles from './Page.module.css';
import styles from './PropertyList.module.css';

const PropertyList: React.FC = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [favTick, setFavTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageSize = 12;
  const [visible, setVisible] = useState(pageSize);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState<'relevant'|'price_asc'|'price_desc'|'newest'|'oldest'>('relevant');
  const sentinelRef = useRef<HTMLDivElement|null>(null);
  // fuerza rerender discreto tras marcar favorito
  void favTick;

  useEffect(() => { (async ()=>{ setLoading(true); const p = await listProperties(); setProperties(p); setLoading(false); })(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const minN = Number(min) || 0;
    const maxN = Number(max) || Number.MAX_SAFE_INTEGER;
    let out = properties.filter((p:any) => (
      (!term || p.title?.toLowerCase().includes(term) || p.address?.toLowerCase().includes(term)) &&
      (typeof p.price !== 'number' || (p.price >= minN && p.price <= maxN))
    ));
    // Sorting
    out = out.slice().sort((a:any, b:any) => {
      if (sort === 'price_asc') return (a.price ?? 0) - (b.price ?? 0);
      if (sort === 'price_desc') return (b.price ?? 0) - (a.price ?? 0);
      if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return 0;
    });
    return out;
  }, [properties, q, min, max, sort]);

  useEffect(() => { setVisible(pageSize); }, [q, min, max, sort]);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setVisible(v => Math.min(filtered.length, v + pageSize));
      }
    }, { rootMargin: '400px' });
    io.observe(node);
    return () => io.disconnect();
  }, [filtered.length]);
  const pageItems = filtered.slice(0, visible);
  return (
    <div>
      <h1 className={pageStyles.title}>Propiedades</h1>
      <div className={styles.filtersRow}>
        <Button variant="outline" onClick={() => setShowFilters(true)}>Filtros</Button>
        <select value={sort} onChange={e => setSort(e.target.value as any)} style={{ border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--fg)', borderRadius: 8, padding: '10px 12px' }}>
          <option value="relevant">Relevancia</option>
          <option value="price_asc">Precio: menor a mayor</option>
          <option value="price_desc">Precio: mayor a menor</option>
          <option value="newest">Novedades</option>
          <option value="oldest">Más antiguas</option>
        </select>
        {user?.role === 'landlord' && <Link to="/dashboard" className={styles.publishLink} style={{ marginLeft: 'auto' }}>Publicar</Link>}
      </div>
      {loading ? (
        <div className={styles.cardGrid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div>
          <p>No hay propiedades publicadas todavía.</p>
          <p>
            ¿Quieres crear una? Ve al <Link to="/dashboard">Dashboard</Link>
            {' '}o <Link to="/login">inicia sesión</Link> para registrarte.
          </p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {pageItems.map(p => (
            <div key={p._id} className={styles.card}>
              <div className={styles.cardMedia}>
                {p.photos?.[0] ? (
                  <div className={styles.mediaInner}>
                    <img
                      loading="lazy"
                      decoding="async"
                      src={toAbsoluteUrl(p.photos[0])}
                      alt={p.title}
                      className={styles.mediaImage}
                    />
                    {p.photos?.[1] && (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={toAbsoluteUrl(p.photos[1])}
                        alt={p.title}
                        className={`${styles.mediaImage} ${styles.hoverSecond}`}
                      />
                    )}
                  </div>
                ) : 'Sin foto'}
                {isNew(p.createdAt) && (
                  <div style={{ position: 'absolute', top: 8, left: 8 }}>
                    <Badge tone="new">Nuevo</Badge>
                  </div>
                )}
              </div>
              <div className={styles.cardBody}>
                <h3 style={{ margin: '6px 0 4px', textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 14 }}>{p.title}</h3>
                <div style={{ fontSize: 14, color: 'var(--muted)' }}>{p.address}</div>
                <div className={styles.price}>{formatPriceEUR(p.price)}</div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Link to={`/p/${p._id}`} className={`${styles.link} ${styles.linkUnderline}`}>Ver detalle</Link>
                  <button
                    aria-label="favorito"
                    onClick={() => { toggleFavorite(String(p._id)); setFavTick(x=>x+1); }}
                    className={styles.iconButton}
                    style={{ fontSize: 18 }}
                  >
                    {isFavorite(String(p._id)) ? '❤' : '♡'}
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div ref={sentinelRef} />
        </div>
      )}
      {/* Drawer de filtros */}
      <Drawer open={showFilters} onClose={() => setShowFilters(false)} side="right">
        <h3 style={{ marginTop: 0 }}>Filtros</h3>
        <div className={styles.filtersRow} style={{ flexDirection: 'column' }}>
          <Input placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Input placeholder="Min €" value={min} onChange={e => setMin(e.target.value)} className={styles.inputSmall} />
            <Input placeholder="Max €" value={max} onChange={e => setMax(e.target.value)} className={styles.inputSmall} />
          </div>
          <div>
            <Button variant="primary" onClick={() => setShowFilters(false)}>Aplicar</Button>
            <Button variant="ghost" style={{ marginLeft: 8 }} onClick={() => { setQ(''); setMin(''); setMax(''); }}>Limpiar</Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default PropertyList;
