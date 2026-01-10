import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { devVerifyMe, getMyVerification } from '../services/verification';
import Badge from '../components/ui/Badge';
import PageHeader from '../components/ui/PageHeader';

const Verification: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isProd = process.env.NODE_ENV === 'production';

  const fetchStatus = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true); setError(null);
      const r = await getMyVerification(user._id);
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
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <PageHeader
        title="Verificacion de identidad"
        subtitle="Protege a propietarios e inquilinos. Solo compartimos lo imprescindible."
      />
      {loading ? <p>Cargando…</p> : (
        <p>
          Estado:{' '}
          <Badge tone={status === 'verified' ? 'highlight' : 'default'}>
            {status || 'unverified'}
          </Badge>
        </p>
      )}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {!isProd && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            En desarrollo puedes marcarte como verificado para probar rutas protegidas.
          </p>
          <button
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={async () => { await devVerifyMe(user._id); await fetchStatus(); }}
          >
            Marcar como verificado (dev)
          </button>
        </div>
      )}
    </div>
  );
};

export default Verification;
