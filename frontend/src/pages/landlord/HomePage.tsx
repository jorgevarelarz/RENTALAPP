import React, { useEffect, useState } from 'react';
import { listContracts } from '../../api/contracts';
import { listIncidents } from '../../api/incidents';
import { listProperties } from '../../api/properties';
import { useAuth } from '../../context/AuthContext';

type MetricState = {
  activeContracts: number;
  totalContracts: number;
  openIncidents: number;
  totalProperties: number;
};

const initialMetrics: MetricState = {
  activeContracts: 0,
  totalContracts: 0,
  openIncidents: 0,
  totalProperties: 0,
};

const LandlordHomePage: React.FC = () => {
  const { token, user } = useAuth();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token || !user) return;
      setLoading(true);
      setError(null);
      try {
        const ownerId = String(user._id);
        const [propertiesRes, contractsRes, incidentsRes] = await Promise.allSettled([
          listProperties({ limit: 200, sort: 'createdAt', dir: 'desc' }),
          listContracts(token, { limit: 200 }),
          listIncidents('owner', token, { limit: 200 }),
        ]);

        const properties = propertiesRes.status === 'fulfilled'
          ? (propertiesRes.value || []).filter((prop: any) => String(prop.ownerId || prop.owner) === ownerId)
          : [];
        const contractsRaw = contractsRes.status === 'fulfilled' ? (contractsRes.value?.items ?? []) : [];
        const incidentsRaw = incidentsRes.status === 'fulfilled' ? (incidentsRes.value?.items ?? []) : [];

        setMetrics({
          totalProperties: properties.length,
          totalContracts: contractsRaw.length,
          activeContracts: contractsRaw.filter((contract: any) => contract.status === 'active').length,
          openIncidents: incidentsRaw.filter((incident: any) => (incident.status || '').toUpperCase() !== 'CLOSED').length,
        });

        if (propertiesRes.status === 'rejected') {
          setError(prev => prev || 'No se pudieron cargar tus propiedades.');
        }
        if (contractsRes.status === 'rejected') {
          setError(prev => prev || 'No se pudieron cargar tus contratos.');
        }
        if (incidentsRes.status === 'rejected') {
          setError(prev => prev || 'No se pudieron cargar tus incidencias.');
        }
      } catch (err: any) {
        setError(err?.message || 'No se pudo cargar el panel de propietario.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, user]);

  if (!user) {
    return <p>Inicia sesión como propietario para ver tu panel.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Panel de propietario</h1>
        <p style={{ margin: 0, color: '#475569' }}>Revisa la ocupación, incidencias y cartera publicada.</p>
      </header>

      {loading && <div style={infoBoxStyle}>Actualizando métricas…</div>}
      {error && <div style={{ ...infoBoxStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <article style={cardStyle}>
          <h2 style={titleStyle}>Contratos activos</h2>
          <p style={metricStyle}>{metrics.activeContracts}</p>
          <p style={captionStyle}>de {metrics.totalContracts} contratos totales</p>
        </article>
        <article style={cardStyle}>
          <h2 style={titleStyle}>Incidencias abiertas</h2>
          <p style={metricStyle}>{metrics.openIncidents}</p>
          <p style={captionStyle}>Escrow y reparaciones en seguimiento</p>
        </article>
        <article style={cardStyle}>
          <h2 style={titleStyle}>Inmuebles publicados</h2>
          <p style={metricStyle}>{metrics.totalProperties}</p>
          <p style={captionStyle}>Incluye borradores y activos</p>
        </article>
      </section>

      <section style={cardStyle}>
        <h2 style={titleStyle}>Accesos rápidos</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="/landlord/properties" style={linkPillStyle}>Gestionar propiedades</a>
          <a href="/landlord/candidates" style={linkPillStyle}>Ver candidatos</a>
          <a href="/landlord/incidents" style={linkPillStyle}>Incidencias</a>
          <a href="/landlord/payments" style={linkPillStyle}>Pagos y escrow</a>
        </div>
      </section>
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 20,
  background: '#fff',
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 6px',
  fontSize: 16,
};

const metricStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 700,
};

const captionStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 12,
  color: '#64748b',
};

const infoBoxStyle: React.CSSProperties = {
  border: '1px solid #cbd5f5',
  background: '#eef2ff',
  color: '#3730a3',
  borderRadius: 12,
  padding: '10px 14px',
};

const linkPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid #e2e8f0',
  textDecoration: 'none',
  color: '#111827',
  fontWeight: 500,
};

export default LandlordHomePage;
