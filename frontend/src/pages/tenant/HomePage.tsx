import React from 'react';
import { useAppSelector } from '../../app/hooks';

const TenantHomePage: React.FC = () => {
  const contracts = useAppSelector(state => state.contracts.items);
  const incidents = useAppSelector(state => state.incidents.items);
  const profile = useAppSelector(state => state.profiles);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Tu panel como inquilino</h1>
        <p style={{ margin: 0, color: '#475569' }}>
          Revisa solicitudes, contratos y estado de tu badge PRO.
        </p>
      </header>
      <section style={cardStyle}>
        <h2 style={sectionTitle}>Badge PRO</h2>
        <p style={{ margin: 0 }}>
          Nivel: <strong>{profile.pro.level}</strong> · Máximo renta {profile.pro.maxRent} €/mes
        </p>
      </section>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Contratos activos</h3>
          <p style={metricValue}>{contracts.filter(c => c.status === 'active').length}</p>
        </div>
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Incidencias abiertas</h3>
          <p style={metricValue}>{incidents.filter(i => i.status !== 'CLOSED').length}</p>
        </div>
      </section>
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 20,
  background: '#f8fafc',
};

const sectionTitle: React.CSSProperties = {
  margin: '0 0 6px',
  fontSize: 16,
  fontWeight: 600,
};

const metricValue: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 700,
};

export default TenantHomePage;
