import React from 'react';
import StatusPill from '../ui/StatusPill';

interface KYCWidgetProps {
  status: 'pending' | 'verified' | 'rejected' | 'expired';
}

const toneMap: Record<KYCWidgetProps['status'], 'neutral' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  verified: 'success',
  rejected: 'danger',
  expired: 'warning',
};

const KYCWidget: React.FC<KYCWidgetProps> = ({ status }) => (
  <div style={{ border: '1px solid #e2e8f0', padding: 16, borderRadius: 16, background: '#fff' }}>
    <h3 style={{ margin: '0 0 8px' }}>Verificación KYC</h3>
    <StatusPill label={status.toUpperCase()} tone={toneMap[status]} />
  </div>
);

export default KYCWidget;
