import React, { useEffect, useMemo, useState } from 'react';
import { listProperties } from '../services/properties';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { SkeletonCard } from '../components/ui/Skeleton';
import Pagination from '../components/ui/Pagination';
import { isFavorite, toggleFavorite } from '../utils/favorites';
import { toAbsoluteUrl } from '../utils/media';

const PropertyList: React.FC = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [favTick, setFavTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  // fuerza rerender discreto tras marcar favorito
  void favTick;

  useEffect(() => { (async ()=>{ setLoading(true); const p = await listProperties(); setProperties(p); setLoading(false); })(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const minN = Number(min) || 0;
    const maxN = Number(max) || Number.MAX_SAFE_INTEGER;
    return properties.filter((p:any) => (
      (!term || p.title?.toLowerCase().includes(term) || p.address?.toLowerCase().includes(term)) &&
      (typeof p.price !== 'number' || (p.price >= minN && p.price <= maxN))
    ));
  }, [properties, q, min, max]);

  const start = (page - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);
  return (
    <div>
      <h1 className="page-title">Propiedades</h1>
      <div className="form-row">
        <Input placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} />
        <Input placeholder="Min €" value={min} onChange={e => setMin(e.target.value)} className="input-sm" />
        <Input placeholder="Max €" value={max} onChange={e => setMax(e.target.value)} className="input-sm" />
        <Button variant="ghost" onClick={() => { setQ(''); setMin(''); setMax(''); }}>Limpiar</Button>
        {user?.role === 'landlord' && <Link to="/dashboard" className="nav-link" style={{ marginLeft: 'auto' }}>Publicar</Link>}
      </div>
      {loading ? (
        <div className="grid-cards">
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
        <div className="grid-cards">
          {pageItems.map(p => (
            <div key={p._id} className="card card-minimal">
              <div className="card-media">
                {p.photos?.[0] ? <img src={toAbsoluteUrl(p.photos[0])} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Sin foto'}
              </div>
              <div className="card-body">
                <h3 style={{ margin: '6px 0 4px', textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 14 }}>{p.title}</h3>
                <div className="muted" style={{ fontSize: 14 }}>{p.address}</div>
                <div className="price">€{p.price}</div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Link to={`/p/${p._id}`} className="link link-underline">Ver detalle</Link>
                  <button aria-label="favorito" onClick={() => { toggleFavorite(String(p._id)); setFavTick(x=>x+1); }} className="btn-icon" style={{ fontSize: 18 }}>
                    {isFavorite(String(p._id)) ? '❤' : '♡'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && filtered.length > 0 && (
        <Pagination page={page} total={filtered.length} pageSize={pageSize} onPage={(p)=>setPage(p)} />
      )}
    </div>
  );
};

export default PropertyList;
