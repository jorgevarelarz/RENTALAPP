import React from 'react';
import { useAuth } from '../../context/AuthContext';

const TenantProfilePage: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <p>Inicia sesión para revisar la información de tu perfil.</p>;
  }

  const tenantPro = user.tenantPro;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Mi perfil</h1>
        <p style={{ margin: 0, color: '#475569' }}>
          Gestiona tu cuenta, revisa el estado Tenant PRO y el correo con el que accedes a la plataforma.
        </p>
      </header>

      <section style={cardStyle}>
        <h2 style={{ margin: '0 0 12px' }}>Datos básicos</h2>
        <dl style={{ display: 'grid', gap: 8, margin: 0 }}>
          <div style={rowStyle}>
            <dt style={labelStyle}>Nombre</dt>
            <dd style={valueStyle}>{user.name || '—'}</dd>
          </div>
          <div style={rowStyle}>
            <dt style={labelStyle}>Correo</dt>
            <dd style={valueStyle}>{user.email}</dd>
          </div>
          <div style={rowStyle}>
            <dt style={labelStyle}>Rol</dt>
            <dd style={valueStyle}>{String(user.role).toUpperCase()}</dd>
          </div>
        </dl>
      </section>

      <section style={cardStyle}>
        <h2 style={{ margin: '0 0 12px' }}>Tenant PRO</h2>
        {tenantPro?.status === 'verified' ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 600, color: '#166534' }}>Estado: Verificado</span>
            <span style={{ color: '#475569' }}>Límite de renta recomendado: {tenantPro?.maxRent?.toLocaleString('es-ES') ?? 0} € / mes</span>
            <span style={{ color: '#475569' }}>Última revisión: {tenantPro?.lastDecisionAt ? new Date(tenantPro.lastDecisionAt).toLocaleDateString('es-ES') : '—'}</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            <span style={{ color: '#475569' }}>Estado actual: {tenantPro?.status ?? 'none'}</span>
            <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
              Aporta documentación para desbloquear viviendas Only PRO y mejorar tu solvencia. Puedes iniciar el proceso desde
              <strong> Perfil &gt; Solvencia PRO</strong>.
            </p>
          </div>
        )}
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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  color: '#94a3b8',
  margin: 0,
};

const valueStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 600,
};

export default TenantProfilePage;
