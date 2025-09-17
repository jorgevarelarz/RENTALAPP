import React, { useEffect, useMemo, useState } from 'react';
import { listContracts } from '../services/contracts';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/ui/Badge';
import { Link } from 'react-router-dom';

const MyContracts: React.FC = () => {
  const { token, user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    const run = async () => {
      if (!token || !user) return;
      try {
        setLoading(true); setError(null);
        const r = await listContracts(token);
        const mine = (r.items || []).filter((c: any) =>
          String(c.ownerId) === user._id || String(c.tenantId) === user._id
        );
        setItems(mine);
      } catch (e: any) {
        setError(e?.message || 'Error cargando contratos');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [token, user]);

  const filtered = useMemo(() => items.filter(c => !status || c.status === status), [items, status]);

  if (!token || !user) return <div>Inicia sesión</div>;
  if (loading) return <div>Cargando contratos...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Mis contratos</h2>
      <div style={{ margin: '8px 0 16px' }}>
        <label style={{ fontSize: 12, color: 'var(--muted)', marginRight: 8 }}>Estado</label>
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">Todos</option>
          <option value="draft">Borrador</option>
          <option value="active">Activo</option>
          <option value="signed">Firmado</option>
          <option value="completed">Completado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <p>No tienes contratos aún.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((c: any) => (
            <div key={c._id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <Link to={`/contracts/${c._id}`} style={{ fontWeight: 700 }}>{String(c.property)}</Link>
                <div style={{ fontSize: 12, opacity: .8 }}>Arrendador: {String(c.ownerId)} — Inquilino: {String(c.tenantId)}</div>
              </div>
              <Badge tone={(c.status || 'draft') as any}>{c.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyContracts;
