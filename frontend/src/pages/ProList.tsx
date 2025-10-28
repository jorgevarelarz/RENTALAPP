import React, { useEffect, useState } from 'react';
import { listPros } from '../api/pro';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Link } from 'react-router-dom';

const SERVICES = [
  { key: '', label: 'Todos' },
  { key: 'plumbing', label: 'Fontanería' },
  { key: 'electricity', label: 'Electricidad' },
  { key: 'appliances', label: 'Electrodomésticos' },
  { key: 'locksmith', label: 'Cerrajería' },
  { key: 'cleaning', label: 'Limpieza' },
  { key: 'painting', label: 'Pintura' },
  { key: 'others', label: 'Otros' },
];

const ProList: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [service, setService] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => { (async ()=>{ const r = await listPros({ service, city }); setItems(r.items || []); })(); }, [service, city]);

  return (
    <div>
      <h2>Profesionales</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'end', margin: '8px 0 16px' }}>
        <label style={{ display: 'grid' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Servicio</span>
          <select value={service} onChange={e => setService(e.target.value)}>
            {SERVICES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </label>
        <Input label="Ciudad" value={city} onChange={e => setCity(e.target.value)} style={{ width: 180 }} />
        <Button variant="ghost" onClick={() => { setService(''); setCity(''); }}>Limpiar</Button>
      </div>
      {items.length === 0 ? <p>No hay profesionales.</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map(p => (
            <div key={p._id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <Link to={`/pros/${p._id}`} style={{ fontWeight: 700 }}>{p.displayName}</Link>
                <div style={{ fontSize: 12, opacity: .8 }}>{p.city}</div>
                <div style={{ fontSize: 12, opacity: .8 }}>{(p.services||[]).map((s:any)=>s.key).join(', ')}</div>
              </div>
              <div style={{ fontSize: 12 }}>⭐ {(p.ratingAvg ?? 0).toFixed(1)} ({p.reviewCount || 0})</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProList;

