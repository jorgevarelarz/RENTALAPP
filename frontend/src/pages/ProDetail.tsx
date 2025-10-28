import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPro } from '../api/pro';
import Card from '../components/ui/Card';

const ProDetail: React.FC = () => {
  const { id } = useParams();
  const [pro, setPro] = useState<any>();
  const [err, setErr] = useState('');
  useEffect(() => { (async ()=>{ try{ if(id){ setPro(await getPro(id)); }}catch(e:any){ setErr(e?.message||'Error'); }})(); }, [id]);
  if (err) return <div style={{ color: 'red' }}>{err}</div>;
  if (!pro) return <div>Cargando…</div>;
  return (
    <div>
      <h2>{pro.displayName}</h2>
      <Card style={{ padding: 16 }}>
        <div><b>Ciudad:</b> {pro.city}</div>
        <div><b>Servicios:</b> {(pro.services||[]).map((s:any)=>s.key).join(', ')}</div>
        <div><b>Valoración:</b> ⭐ {(pro.ratingAvg ?? 0).toFixed(1)} ({pro.reviewCount || 0})</div>
      </Card>
    </div>
  );
};

export default ProDetail;

