import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { devVerifyMe, getMyVerification } from '../services/verification';

const Verification: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true); setError(null);
      const r = await getMyVerification(user.id);
      setStatus(r.status || 'unverified');
    } catch (e: any) {
      setError(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  if (!user) return <div>Inicia sesión</div>;

  return (
    <div>
      <h2>Verificación de identidad</h2>
      {loading ? <p>Cargando…</p> : <p>Estado: <b>{status || 'unverified'}</b></p>}
      {error && <p style={{color:'red'}}>Error: {error}</p>}
      <p>En desarrollo puedes marcarte como verificado para probar las rutas protegidas.</p>
      <button className="btn" onClick={async () => { await devVerifyMe(user.id); await fetchStatus(); }}>
        Marcar como verificado (dev)
      </button>
    </div>
  );
};

export default Verification;
