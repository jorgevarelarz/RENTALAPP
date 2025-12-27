import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ProBadge from '../../components/ProBadge';
import { api as axios } from '../../api/client';
import { ContractStatusBadge } from '../../components/ContractStatusBadge';
import { acceptApplicationVisit, proposeApplicationVisit } from '../../services/appointments';

export default function TenantApplications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposeFor, setProposeFor] = useState<string | null>(null);
  const [proposedDate, setProposedDate] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get('/api/applications/my');
        setItems(data.items || []);
      } catch (e: any) {
        setError(e?.response?.data?.error || e?.message || 'Error cargando solicitudes');
      } finally {
        setLoading(false);
      }
    };
    if (user?.role === 'tenant') load();
  }, [user]);

  const isTenantPro = user?.role === 'tenant' && user?.tenantPro?.status === 'verified';
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Solicitudes</h2>
      {isTenantPro && (
        <div style={{ marginBottom: 8 }}>
          <ProBadge maxRent={user?.tenantPro?.maxRent} />
        </div>
      )}
      {loading && <p>Cargando solicitudes...</p>}
      {error && <p style={{ color: '#b91c1c' }}>Error: {error}</p>}
      {!loading && !error && items.length === 0 && <p>No tienes solicitudes aún.</p>}
      {!loading && !error && items.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((app) => (
            <div key={app._id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{app.property?.title || 'Propiedad'}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {app.property?.city || ''} {app.property?.address || ''}
                  </div>
                  {app.proposedDate && (
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      Propuesta: {new Date(app.proposedDate).toLocaleString()}
                    </div>
                  )}
                  {app.visitDate && (
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      Visita: {new Date(app.visitDate).toLocaleString()}
                    </div>
                  )}
                </div>
                <ContractStatusBadge status={app.status || 'pending'} />
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {app.status === 'proposed' && app.proposedBy === 'landlord' && (
                  <>
                    <button
                      onClick={async () => {
                        await acceptApplicationVisit(app._id);
                        const { data } = await axios.get('/api/applications/my');
                        setItems(data.items || []);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs"
                    >
                      Aceptar visita
                    </button>
                    <button
                      onClick={() => {
                        setProposeFor(app._id);
                        setProposedDate('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs"
                    >
                      Proponer nueva hora
                    </button>
                  </>
                )}
                {proposeFor === app._id && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="datetime-local"
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                      className="border rounded px-2 py-1 text-xs"
                    />
                    <button
                      onClick={async () => {
                        if (!proposedDate) return;
                        await proposeApplicationVisit(app._id, proposedDate);
                        setProposeFor(null);
                        const { data } = await axios.get('/api/applications/my');
                        setItems(data.items || []);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs"
                    >
                      Enviar propuesta
                    </button>
                  </div>
                )}
                {app.status === 'proposed' && app.proposedBy === 'tenant' && (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Propuesta enviada. Esperando respuesta del propietario.
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
