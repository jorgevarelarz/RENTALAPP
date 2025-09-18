import React, { useEffect, useState } from 'react';
import {
  decideTenantPro,
  listPendingTenantPro,
  purgeTenantPro,
} from '../../services/tenantPro';

export default function AdminTenantProPage() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxRentDraft, setMaxRentDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPendingTenantPro();
      setPending(data);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDecision = async (userId: string, decision: 'approved' | 'rejected') => {
    try {
      const amount = Number(maxRentDraft[userId] || 0);
      await decideTenantPro(userId, decision, amount);
      setMessage(`Solicitud ${decision === 'approved' ? 'aprobada' : 'rechazada'}`);
      setMaxRentDraft(prev => ({ ...prev, [userId]: '' }));
      await load();
    } catch (err: any) {
      setError(err?.message || 'No se pudo guardar la decisión');
    }
  };

  const onPurge = async (userId: string) => {
    if (!window.confirm('¿Purgar todos los documentos de este usuario?')) return;
    await purgeTenantPro(userId);
    setMessage('Documentación eliminada');
    await load();
  };

  return (
    <div style={{ padding: 24, display: 'grid', gap: 16 }}>
      <h2>Revisión Inquilino PRO</h2>
      {message && <div style={{ background: '#dcfce7', padding: 12, borderRadius: 8 }}>{message}</div>}
      {error && <div style={{ color: '#ef4444' }}>{error}</div>}
      {loading && <div>Cargando…</div>}
      {!loading && pending.length === 0 && <div>No hay solicitudes pendientes.</div>}
      {!loading && pending.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: 8 }}>Usuario</th>
              <th style={{ padding: 8 }}>Docs</th>
              <th style={{ padding: 8 }}>Max rent</th>
              <th style={{ padding: 8 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pending.map(user => (
              <tr key={user._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{user.email}</div>
                  <small>{user.tenantPro?.docs?.length || 0} documentos</small>
                </td>
                <td style={{ padding: 8 }}>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {(user.tenantPro?.docs || []).map((doc: any) => (
                      <li key={doc._id}>{doc.type}</li>
                    ))}
                  </ul>
                </td>
                <td style={{ padding: 8 }}>
                  <input
                    type="number"
                    placeholder="€/mes"
                    value={maxRentDraft[user._id] ?? ''}
                    onChange={e =>
                      setMaxRentDraft(prev => ({
                        ...prev,
                        [user._id]: e.target.value,
                      }))
                    }
                    style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid #d4d4d8' }}
                  />
                </td>
                <td style={{ padding: 8, display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onDecision(user._id, 'approved')}
                    style={{ background: '#22c55e', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px' }}
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    onClick={() => onDecision(user._id, 'rejected')}
                    style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px' }}
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    onClick={() => onPurge(user._id)}
                    style={{ background: '#111827', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px' }}
                  >
                    Purgar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
