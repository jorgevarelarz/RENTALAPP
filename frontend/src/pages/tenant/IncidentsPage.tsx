import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listIncidents } from '../../api/incidents';
import type { Incident } from '@rental-app/types/incidents';
import Badge from '../../components/ui/Badge';

const statusLabel: Record<string, string> = {
  OPEN: 'Abierta',
  quote: 'Presupuesto',
  QUOTE: 'Presupuesto',
  ESCROW: 'En escrow',
  IN_PROGRESS: 'En curso',
  in_progress: 'En curso',
  EXTRA_REQUESTED: 'Extra solicitado',
  DONE: 'Resuelta',
  DISPUTE: 'Disputa',
  CLOSED: 'Cerrada',
  awaiting_schedule: 'Pendiente de cita',
  awaiting_validation: 'Pendiente de validación',
};

const statusTone = (status: string): 'default' | 'new' | 'highlight' => {
  const upper = status.toUpperCase();
  if (upper === 'ESCROW' || upper === 'DISPUTE') return 'highlight';
  if (upper === 'OPEN' || upper === 'IN_PROGRESS' || status === 'awaiting_schedule' || status === 'awaiting_validation') return 'new';
  return 'default';
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const TenantIncidentsPage: React.FC = () => {
  const { token } = useAuth();
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        const response = await listIncidents('tenant', token, { limit: 50 });
        setItems(response?.items ?? []);
      } catch (err: any) {
        const message = err?.response?.data?.error || err?.message || 'No se pudieron cargar tus incidencias.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const openCount = useMemo(() => items.filter(item => item.status !== 'CLOSED' && item.status !== 'closed').length, [items]);

  if (!token) {
    return <p>Inicia sesión para gestionar tus incidencias.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Incidencias</h1>
        <p style={{ margin: 0, color: '#475569' }}>Abre tickets con fotos, chatea y haz seguimiento del profesional asignado.</p>
      </header>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Incidencias abiertas</span>
          <strong style={summaryValueStyle}>{openCount}</strong>
        </div>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Total incidencias</span>
          <strong style={summaryValueStyle}>{items.length}</strong>
        </div>
      </section>

      {loading && <div style={infoBoxStyle}>Cargando incidencias…</div>}
      {error && <div style={{ ...infoBoxStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      {items.length === 0 && !loading ? (
        <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
          <p style={{ margin: 0 }}>No tienes incidencias registradas. Si surge algún problema con la vivienda, crea un ticket desde la app.</p>
        </div>
      ) : (
        <section style={{ display: 'grid', gap: 12 }}>
          {items.map(item => {
            const status = String(item.status || 'OPEN');
            const label = statusLabel[status] ?? status;
            return (
              <article key={item.id} style={cardStyle}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>Ticket #{item.id.slice(-6)}</h2>
                  <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
                    Creada {formatDate(item.createdAt)}
                  </p>
                </div>
                <Badge tone={statusTone(status)}>{label}</Badge>
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

export default TenantIncidentsPage;
