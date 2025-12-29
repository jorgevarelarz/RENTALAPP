import React, { useEffect, useMemo, useState } from 'react';
import { listContracts } from '../services/contracts';
import { useAuth } from '../context/AuthContext';
import { ContractStatusBadge } from '../components/ContractStatusBadge';
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
          {filtered.map((c: any) => {
            const propertyTitle =
              typeof c.property === 'object'
                ? c.property?.title || c.property?.address || 'Propiedad'
                : String(c.property || 'Propiedad');
            const landlordLabel = c.landlordName || c.ownerId || '-';
            const tenantLabel = c.tenantName || c.tenantId || '-';
            const formatDate = (value?: string) => {
              if (!value) return null;
              const parsed = new Date(value);
              if (Number.isNaN(parsed.getTime())) return null;
              return parsed.toLocaleDateString('es-ES');
            };
            const startLabel = formatDate(c.signedAt || c.startDate);
            const endLabel = formatDate(c.endDate);
            return (
            <div key={c._id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <Link to={`/contracts/${c._id}`} style={{ fontWeight: 700 }}>{propertyTitle}</Link>
                <div style={{ fontSize: 12, opacity: .8 }}>Arrendador: {String(landlordLabel)} — Inquilino: {String(tenantLabel)}</div>
                {(startLabel || endLabel) && (
                  <div style={{ fontSize: 12, opacity: .8 }}>Vigencia: {startLabel || '-'} a {endLabel || '-'}</div>
                )}
              </div>
              <ContractStatusBadge status={c.status || 'draft'} />
            </div>
          )})}
        </div>
      )}
    </div>
  );
};

export default MyContracts;
