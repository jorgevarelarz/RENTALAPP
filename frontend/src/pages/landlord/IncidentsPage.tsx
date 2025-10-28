import React, { useEffect, useMemo, useState } from 'react';
import { listIncidents } from '../../api/incidents';
import { useAuth } from '../../context/AuthContext';
import Badge from '../../components/ui/Badge';

type OwnerIncident = {
  id: string;
  propertyId?: string;
  title?: string;
  status: string;
  createdAt: string;
};

const statusLabel: Record<string, string> = {
  OPEN: 'Abierta',
  QUOTE: 'Presupuesto',
  ESCROW: 'En escrow',
  IN_PROGRESS: 'En curso',
  EXTRA_REQUESTED: 'Extra solicitado',
  DONE: 'Resuelta',
  DISPUTE: 'Disputa',
  CLOSED: 'Cerrada',
  awaiting_schedule: 'Pendiente de cita',
  awaiting_validation: 'Pendiente de validación',
};

const statusTone = (value: string): 'default' | 'new' | 'highlight' => {
  const upper = value.toUpperCase();
  if (upper === 'ESCROW' || upper === 'DISPUTE') return 'highlight';
  if (upper === 'OPEN' || upper === 'IN_PROGRESS' || value === 'awaiting_schedule' || value === 'awaiting_validation') return 'new';
  return 'default';
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const LandlordIncidentsPage: React.FC = () => {
  const { token } = useAuth();
  const [items, setItems] = useState<OwnerIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        const response = await listIncidents('owner', token, { limit: 100 });
        const mapped = (response?.items ?? []).map((incident: any) => ({
          id: String(incident?._id || incident?.id),
          propertyId: incident?.propertyId ? String(incident.propertyId) : undefined,
          title: incident?.title ? String(incident.title) : undefined,
          status: String(incident?.status || 'OPEN'),
          createdAt: incident?.createdAt ? String(incident.createdAt) : new Date().toISOString(),
        }));
        setItems(mapped);
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'No se pudieron cargar las incidencias.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const escrowCount = useMemo(() => items.filter(item => item.status.toUpperCase() === 'ESCROW').length, [items]);

  if (!token) {
    return <p>Inicia sesión para gestionar incidencias de tus propiedades.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Incidencias</h1>
        <p style={{ margin: 0, color: '#475569' }}>Aprueba presupuestos, controla el escrow y valida el cierre.</p>
      </header>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Incidencias abiertas</span>
          <strong style={summaryValueStyle}>{items.filter(item => item.status.toUpperCase() !== 'CLOSED').length}</strong>
        </div>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>En escrow</span>
          <strong style={summaryValueStyle}>{escrowCount}</strong>
        </div>
      </section>

      {loading && <div style={infoBoxStyle}>Cargando incidencias…</div>}
      {error && <div style={{ ...infoBoxStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      {items.length === 0 && !loading ? (
        <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
          <p style={{ margin: 0 }}>No hay incidencias abiertas en tus propiedades.</p>
        </div>
      ) : (
        <section style={{ display: 'grid', gap: 12 }}>
          {items.map(incident => (
            <article key={incident.id} style={cardStyle}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{incident.title ?? `Ticket #${incident.id.slice(-6)}`}</h2>
                <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
                  Creada el {formatDate(incident.createdAt)}
                </p>
              </div>
              <Badge tone={statusTone(incident.status)}>{statusLabel[incident.status] ?? incident.status}</Badge>
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

export default LandlordIncidentsPage;
