import React from 'react';
import LandlordDashboard from '../../pages/LandlordDashboard';

const LandlordPropertiesPage: React.FC = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <header>
      <h1 style={{ marginBottom: 4 }}>Mis inmuebles</h1>
      <p style={{ margin: 0, color: '#475569' }}>
        Crea nuevas propiedades, gestiona fotos, precios y decide si son Only PRO.
      </p>
    </header>
    <LandlordDashboard />
  </div>
);

export default LandlordPropertiesPage;
