import React, { useEffect, useMemo, useState } from 'react';
import Badge from '../../components/ui/Badge';
import { listContracts } from '../../api/contracts';
import { useAuth } from '../../context/AuthContext';

type ContractStatus = 'draft' | 'in_review' | 'signing' | 'signed' | 'active' | 'completed' | string;

type TenantContract = {
  id: string;
  property: string;
  status: ContractStatus;
  updatedAt?: string;
  startDate?: string;
  endDate?: string;
  rent?: number;
};

const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  in_review: 'En revisión',
  signing: 'En firma',
  signed: 'Firmado',
  active: 'Activo',
  completed: 'Completado',
};

const statusTone = (status: string): 'default' | 'new' | 'highlight' => {
  if (status === 'active' || status === 'signed') return 'highlight';
  if (status === 'signing' || status === 'in_review') return 'new';
  return 'default';
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
};

const TenantContractsPage: React.FC = () => {
  const { token } = useAuth();
  const [items, setItems] = useState<TenantContract[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        const response = await listContracts(token, { limit: 50 });
        const mapped = (response?.items ?? []).map((contract: any) => ({
          id: String(contract?._id || contract?.id),
          property: String(contract?.property?.title || contract?.property || 'Contrato'),
          status: String(contract?.status || 'draft') as ContractStatus,
          updatedAt: contract?.updatedAt || contract?.lastUpdate,
          startDate: contract?.startDate,
          endDate: contract?.endDate,
          rent: typeof contract?.rent === 'number' ? contract.rent : contract?.rentAmount,
        }));
        setItems(mapped);
      } catch (err: any) {
        const message = err?.response?.data?.error || err?.message || 'No se pudieron cargar tus contratos.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const activeCount = useMemo(() => items.filter(item => item.status === 'active').length, [items]);

  if (!token) {
    return <p>Inicia sesión para ver tus contratos.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Contratos</h1>
        <p style={{ margin: 0, color: '#475569' }}>Firma electrónica, descargas y próximos hitos del arrendamiento.</p>
      </header>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Contratos activos</span>
          <strong style={summaryValueStyle}>{activeCount}</strong>
        </div>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Total contratos</span>
          <strong style={summaryValueStyle}>{items.length}</strong>
        </div>
      </section>

      {loading && <div style={infoBoxStyle}>Cargando contratos…</div>}
      {error && <div style={{ ...infoBoxStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      {items.length === 0 && !loading ? (
        <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
          <p style={{ margin: 0 }}>Aún no tienes contratos publicados o en firma con este perfil.</p>
        </div>
      ) : (
        <section style={{ display: 'grid', gap: 12 }}>
          {items.map(contract => {
            const status = contract.status.toLowerCase();
            const statusText = statusLabel[status] ?? status;
            return (
              <article key={contract.id} style={cardStyle}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{contract.property}</h2>
                  <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
                    Actualizado {formatDate(contract.updatedAt)} · Vigente {formatDate(contract.startDate)} — {formatDate(contract.endDate)}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <Badge tone={statusTone(status)}>{statusText}</Badge>
                  {contract.rent !== undefined && (
                    <span style={{ fontSize: 12, color: '#475569' }}>{contract.rent.toLocaleString('es-ES')} € / mes</span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
};

const summaryCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: '#64748b',
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: 24,
  marginTop: 6,
};

const infoBoxStyle: React.CSSProperties = {
  border: '1px solid #cbd5f5',
  background: '#eef2ff',
  color: '#3730a3',
  borderRadius: 12,
  padding: '10px 14px',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
};

export default TenantContractsPage;
