import React from 'react';
import { useAppSelector } from '../../app/hooks';

const TenantKycPage: React.FC = () => {
  const kyc = useAppSelector(state => state.profiles.kyc);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Verificación KYC</h1>
        <p style={{ margin: 0, color: '#475569' }}>
          Sube tu DNI/NIE y selfie. En este modo demo puedes simular los estados.
        </p>
      </header>
      <section style={cardStyle}>
        <p style={{ margin: 0 }}>Estado actual: <strong>{kyc.status.toUpperCase()}</strong></p>
        {kyc.updatedAt && <p style={{ margin: 0 }}>Actualizado el {new Date(kyc.updatedAt).toLocaleDateString()}</p>}
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

export default TenantKycPage;
