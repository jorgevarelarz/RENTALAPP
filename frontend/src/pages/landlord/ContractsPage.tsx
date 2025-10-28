import React, { useEffect, useMemo, useState } from 'react';
import { listContracts } from '../../api/contracts';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/ui/Badge';

type LandlordContract = {
  id: string;
  tenantName?: string;
  property?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  updatedAt?: string;
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

const LandlordContractsPage: React.FC = () => {
  const { token } = useAuth();
  const [items, setItems] = useState<LandlordContract[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        const response = await listContracts(token, { limit: 100 });
        const mapped = (response?.items ?? []).map((contract: any) => ({
          id: String(contract?._id || contract?.id),
          tenantName: contract?.tenantSnapshot?.name || contract?.tenant?.name,
          property: contract?.property?.title || contract?.propertyTitle || contract?.property || 'Contrato',
          status: String(contract?.status || 'draft'),
          startDate: contract?.startDate,
          endDate: contract?.endDate,
          updatedAt: contract?.updatedAt || contract?.lastUpdate,
        }));
        setItems(mapped);
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'No se pudieron cargar tus contratos.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const signingCount = useMemo(
    () => items.filter(item => item.status === 'signing' || item.status === 'in_review').length,
    [items],
  );

  if (!token) {
    return <p>Inicia sesión para revisar los contratos con tus inquilinos.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Contratos</h1>
        <p style={{ margin: 0, color: '#475569' }}>
          Controla el estado de firma, descarga PDFs y revisa las fechas clave de cada inquilino.
        </p>
      </header>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Contratos activos</span>
          <strong style={summaryValueStyle}>{items.filter(item => item.status === 'active').length}</strong>
        </div>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>En firma / revisión</span>
          <strong style={summaryValueStyle}>{signingCount}</strong>
        </div>
      </section>

      {loading && <div style={infoBoxStyle}>Cargando contratos…</div>}
      {error && <div style={{ ...infoBoxStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      {items.length === 0 && !loading ? (
        <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
          <p style={{ margin: 0 }}>Aún no tienes contratos. Crea uno desde la ficha de un candidato o al aceptar una reserva.</p>
        </div>
      ) : (
        <section style={{ display: 'grid', gap: 12 }}>
          {items.map(contract => (
            <article key={contract.id} style={cardStyle}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{contract.property}</h2>
                <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
                  Inquilino: {contract.tenantName || '—'} · Vigencia {formatDate(contract.startDate)} — {formatDate(contract.endDate)}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <Badge tone={statusTone(contract.status || 'draft')}>{contract.status}</Badge>
                <span style={{ fontSize: 12, color: '#475569' }}>Actualizado {formatDate(contract.updatedAt)}</span>
              </div>
            </article>
          ))}
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

export default LandlordContractsPage;
