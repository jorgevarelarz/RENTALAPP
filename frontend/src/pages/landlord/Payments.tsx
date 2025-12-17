import React, { useState } from 'react';
import { usePolicyAcceptance } from '../hooks/usePolicyAcceptance';
import PolicyModal from '../components/PolicyModal';

export default function LandlordPayments() {
  const [showModal, setShowModal] = useState(false);
  const { needsAcceptance, pendingPolicy, acceptPolicy } = usePolicyAcceptance([
    'terms_of_service',
    'data_processing',
  ]);

  const handleAccept = async () => {
    await acceptPolicy();
    setShowModal(false);
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Pagos (Propietario)</h2>
      <p>Escrow: retenciones (hold), liberaciones (release) y cobros.</p>
      {needsAcceptance && (
        <div style={{ padding: 12, border: '1px solid #f59e0b', borderRadius: 8, background: '#fffbeb' }}>
          <strong>Debes aceptar las políticas vigentes</strong>
          <p style={{ margin: '8px 0' }}>
            Falta aceptar: {pendingPolicy?.policyType ?? 'políticas obligatorias'}.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowModal(true)}>Ver políticas</button>
            <button onClick={handleAccept}>Aceptar y continuar</button>
          </div>
        </div>
      )}

      <PolicyModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        policyTypes={['terms_of_service', 'data_processing']}
        pendingType={pendingPolicy?.policyType}
      />
    </div>
  );
}
