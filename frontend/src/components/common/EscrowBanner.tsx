import React from 'react';

interface EscrowBannerProps {
  amount: number;
  status: 'HELD' | 'RELEASED' | 'REFUNDED';
}

const statusCopy: Record<EscrowBannerProps['status'], string> = {
  HELD: 'Retenido hasta que el propietario valide el cierre.',
  RELEASED: 'Liberado al profesional.',
  REFUNDED: 'Reembolsado al inquilino.',
};

const EscrowBanner: React.FC<EscrowBannerProps> = ({ amount, status }) => (
  <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: '#f8fafc' }}>
    <strong>Escrow activo</strong>
    <p style={{ margin: '4px 0 0' }}>
      {amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} · {statusCopy[status]}
    </p>
  </div>
);

export default EscrowBanner;
