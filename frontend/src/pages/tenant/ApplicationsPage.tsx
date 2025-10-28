import React, { useEffect, useMemo, useState } from 'react';
import { listApplications } from '../../api/applications';
import { useAuth } from '../../context/AuthContext';
import type { Application } from '@rental-app/types/applications';
import Badge from '../../components/ui/Badge';

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  visited: 'Visita programada',
};

const statusTone = (value: string): 'default' | 'new' | 'highlight' => {
  if (value === 'accepted') return 'highlight';
  if (value === 'pending') return 'new';
  return 'default';
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
};

const TenantApplicationsPage: React.FC = () => {
  const { token } = useAuth();
  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        setLoading(true);
        setError(null);
        const response = await listApplications(token, { limit: 20 });
        setItems(response?.items ?? []);
        setTotal(typeof response?.total === 'number' ? response.total : response?.items?.length ?? 0);
      } catch (err: any) {
        const message = err?.response?.data?.error || err?.message || 'No se pudieron cargar tus solicitudes.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const pendingCount = useMemo(() => items.filter(item => item.status === 'pending').length, [items]);

  if (!token) {
    return <p>Inicia sesión para consultar tus solicitudes.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Tus solicitudes</h1>
        <p style={{ margin: 0, color: '#475569' }}>
          Consulta el estado de tus aplicaciones y visitas programadas en las propiedades que te interesan.
        </p>
      </header>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Solicitudes enviadas</span>
          <strong style={summaryValueStyle}>{total}</strong>
        </div>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Pendientes de respuesta</span>
          <strong style={summaryValueStyle}>{pendingCount}</strong>
        </div>
      </section>

      {loading && <div style={infoBoxStyle}>Cargando solicitudes…</div>}
      {error && <div style={{ ...infoBoxStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      {items.length === 0 && !loading ? (
        <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
          <p style={{ margin: 0 }}>Aún no has enviado solicitudes. Explora propiedades y aplica para iniciar el proceso.</p>
        </div>
      ) : (
        <section style={{ display: 'grid', gap: 12 }}>
          {items.map(item => {
            const label = item.property?.title ?? `Solicitud ${item.id.slice(-6)}`;
            const subtitle = item.property?.city
              ? `${item.property.city} · ${formatDate(item.createdAt)}`
              : `Enviada el ${formatDate(item.createdAt)}`;
            const status = statusLabel[item.status] ?? item.status;
            return (
              <article key={item.id} style={listCardStyle}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{label}</h2>
                  <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>{subtitle}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <Badge tone={statusTone(item.status)}>{status}</Badge>
                  {item.visitDate && (
                    <span style={{ fontSize: 12, color: '#475569' }}>Visita: {formatDate(item.visitDate)}</span>
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

const listCardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
};

export default TenantApplicationsPage;
