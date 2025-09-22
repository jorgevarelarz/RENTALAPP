import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getUpsell, clickService, remindLater, dismissUpsell, type UpsellState } from '../../api/postsign';

export default function ServiceUpsell() {
  const params = useParams();
  const contractId = params.id as string;
  const [st, setSt] = useState<UpsellState | null>(null);

  useEffect(() => { if (contractId) getUpsell(contractId).then(setSt).catch(()=>{}); }, [contractId]);

  if (!st || !contractId) return null;
  if (st.status === 'dismissed') return null;
  if (st.status === 'remind_later' && st.remindAt && new Date(st.remindAt) > new Date()) return null;

  return (
    <section className="upsell-card" style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>🎉 ¡Felicidades! Tu contrato en {st.address ?? ''} está firmado.</h2>
      <p>Activa ahora tus servicios básicos para tu nueva vivienda:</p>

      <div className="upsell-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {st.services?.map((s: any) => (
          <article className="upsell-item" key={s._id || s.id} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 12 }}>
            {s.logo && <img className="upsell-logo" src={s.logo} alt={s.name} style={{ height: 40, objectFit: 'contain' }} />}
            <h3>{s.name}</h3>
            {s.description && <p style={{ color: '#6B7280' }}>{s.description}</p>}
            <button
              className="btn btn-primary"
              style={{ border: '1px solid #111827', background: '#111827', color: '#fff', borderRadius: 8, padding: '8px 12px' }}
              onClick={async () => { await clickService(contractId, s._id || s.id); window.location.href = s.url; }}
            >
              Contratar
            </button>
          </article>
        ))}
      </div>

      <div className="upsell-actions" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="btn btn-outline"
          style={{ border: '1px solid #D1D5DB', color: '#111827', borderRadius: 8, padding: '8px 12px', background: '#fff' }}
          title="Lo volveremos a mostrar en unos días"
          onClick={async () => {
            const r = await remindLater(contractId, { days: 3 });
            setSt((prev: UpsellState | null) => (prev ? { ...prev, status: 'remind_later', remindAt: r.remindAt } : prev));
          }}
        >
          Más tarde
        </button>

        <button
          className="btn btn-text"
          style={{ border: 'none', background: 'transparent', color: '#6B7280', padding: '8px 12px', borderRadius: 8 }}
          title="No volveremos a mostrar esta oferta para este contrato"
          onClick={async () => {
            await dismissUpsell(contractId);
            setSt((prev: UpsellState | null) => (prev ? { ...prev, status: 'dismissed' } : prev));
          }}
        >
          Ahora no
        </button>
      </div>
    </section>
  );
}
