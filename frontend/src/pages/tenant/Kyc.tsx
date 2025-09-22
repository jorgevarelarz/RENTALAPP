import React, { useEffect, useState } from 'react';
import { getMyVerification, devVerifyMe } from '../../services/verification';
import { useAuth } from '../../context/AuthContext';

export default function TenantKyc() {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        if (!user?._id) return;
        const r = await getMyVerification(user._id);
        setStatus(r.status);
      } catch (e: any) {
        setError(e?.message || 'No se pudo cargar el estado');
      }
    })();
  }, [user?._id]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2>Verificación KYC</h2>
      {error && <div style={{ color: '#b91c1c' }}>{error}</div>}
      <div>Estado: <b>{status}</b></div>
      <div style={{ fontSize: 14, color: '#6b7280' }}>Sube tu documentación desde la app móvil (pendiente de integración UI completa).</div>
      <div>
        <button onClick={async ()=>{ if(!user?._id) return; await devVerifyMe(user._id); setStatus('verified'); }}>Marcar verificado (dev)</button>
      </div>
    </div>
  );
}
