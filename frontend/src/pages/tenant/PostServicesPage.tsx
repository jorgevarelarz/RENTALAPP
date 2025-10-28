import React from 'react';

const TenantPostServicesPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Servicios post-firma</h1>
      <p style={{ margin: 0, color: '#475569' }}>
        Activa luz, gas e internet con tarifas negociadas. Puedes hacerlo ahora o más tarde.
      </p>
    </header>
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {['Luz', 'Gas', 'Internet'].map(service => (
        <article key={service} style={cardStyle}>
          <h2 style={{ margin: '0 0 6px' }}>{service}</h2>
          <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>Oferta demo con condiciones especiales.</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" style={primaryButton}>Contratar ahora</button>
            <button type="button" style={ghostButton}>Más tarde</button>
          </div>
        </article>
      ))}
    </div>
  </div>
);

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 20,
  background: '#fff',
};

const primaryButton: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: 'none',
  background: '#111827',
  color: '#fff',
  cursor: 'pointer',
};

const ghostButton: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #cbd5f5',
  background: 'transparent',
  color: '#111827',
  cursor: 'pointer',
};

export default TenantPostServicesPage;
