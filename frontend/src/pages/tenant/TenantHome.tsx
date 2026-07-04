import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import { AlertCircle, Clock3, CreditCard, FileSignature, Heart, Home, Search, ShieldCheck } from 'lucide-react';
import OnboardingChecklist from '../../components/OnboardingChecklist';
import { listContracts } from '../../services/contracts';
import { getFavorites } from '../../utils/favorites';
import { formatApiError } from '../../api/client';

type TenantSummary = {
  contracts: any[];
  favorites: number;
  loading: boolean;
  error: string;
};

function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    active: 'Activo',
    signed: 'Firmado',
    draft: 'Borrador',
    completed: 'Completado',
    cancelled: 'Cancelado',
  };
  return labels[status || ''] || 'Pendiente';
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <Card className="border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-sm text-gray-500">{hint}</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 text-blue-700">{icon}</div>
      </div>
    </Card>
  );
}

export default function TenantHome() {
  const { token, user } = useAuth();
  const [summary, setSummary] = useState<TenantSummary>({
    contracts: [],
    favorites: 0,
    loading: true,
    error: '',
  });

  const firstName =
    (user as any)?.name?.split?.(' ')?.[0] ||
    user?.email?.split?.('@')?.[0] ||
    'Inquilino';

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const favorites = getFavorites().length;
        const contracts = token ? (await listContracts(token)).items || [] : [];
        if (!active) return;
        setSummary({ contracts, favorites, loading: false, error: '' });
      } catch (err) {
        if (!active) return;
        setSummary({
          contracts: [],
          favorites: getFavorites().length,
          loading: false,
          error: formatApiError(err, 'No se pudo cargar tu resumen'),
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [token]);

  const activeContract = useMemo(
    () => summary.contracts.find((contract) => ['active', 'signed'].includes(contract?.status)),
    [summary.contracts],
  );

  const pendingContracts = useMemo(
    () => summary.contracts.filter((contract) => ['draft', 'pending'].includes(contract?.status)).length,
    [summary.contracts],
  );

  const tenantProStatus = user?.tenantPro?.status || 'pending';
  const tenantProLabel = tenantProStatus === 'verified' ? 'Verificado' : tenantProStatus === 'rejected' ? 'Revisar' : 'Pendiente';

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-8">
        <h1 className="text-3xl font-bold text-gray-900">Hola, {firstName}</h1>
        <p className="text-gray-600 mt-2 text-lg">
          ¿En qué podemos ayudarte hoy? Gestiona tu hogar desde aquí.
        </p>
      </div>

      <OnboardingChecklist role="tenant" />

      {summary.error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{summary.error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Home size={22} />}
          label="Contrato activo"
          value={summary.loading ? '...' : activeContract ? '1' : '0'}
          hint={activeContract ? statusLabel(activeContract.status) : 'Sin alquiler activo'}
        />
        <StatCard
          icon={<Clock3 size={22} />}
          label="En trámite"
          value={summary.loading ? '...' : pendingContracts}
          hint="Contratos por revisar o firmar"
        />
        <StatCard
          icon={<Heart size={22} />}
          label="Favoritos"
          value={summary.loading ? '...' : summary.favorites}
          hint="Viviendas guardadas"
        />
        <StatCard
          icon={<ShieldCheck size={22} />}
          label="Tenant PRO"
          value={tenantProLabel}
          hint={tenantProStatus === 'verified' ? 'Perfil listo para aplicar' : 'Completa la verificación'}
        />
      </div>

      {activeContract && (
        <Card className="border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Alquiler actual</p>
              <h2 className="mt-1 text-xl font-bold text-gray-900">
                {activeContract.property?.title || activeContract.property?.address || 'Contrato activo'}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Estado: {statusLabel(activeContract.status)}
              </p>
            </div>
            <Link
              to={`/contracts/${activeContract._id}`}
              className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Ver contrato
            </Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/properties" className="block group">
          <Card
            style={{ height: '100%', padding: '24px', transition: 'all 0.2s', borderColor: 'transparent' }}
            className="hover:shadow-lg hover:border-blue-200 border bg-white"
          >
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
              <Search className="text-blue-600 group-hover:text-white" size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2">Buscar nuevo hogar</h3>
            <p className="text-sm text-gray-500">Explora propiedades verificadas y filtra por tus preferencias.</p>
          </Card>
        </Link>

        <Link to="/tenant-pro" className="block group">
          <Card
            style={{ height: '100%', padding: '24px', transition: 'all 0.2s', borderColor: 'transparent' }}
            className="hover:shadow-lg hover:border-emerald-200 border bg-white"
          >
            <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-600 transition-colors">
              <ShieldCheck className="text-emerald-600 group-hover:text-white" size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2">Perfil Tenant PRO</h3>
            <p className="text-sm text-gray-500">
              {user?.tenantPro?.status === 'verified'
                ? '¡Tu perfil está verificado! Tienes prioridad.'
                : 'Verifica tu identidad y destaca ante los propietarios.'}
            </p>
          </Card>
        </Link>

        <Link to="/contracts" className="block group">
          <Card
            style={{ height: '100%', padding: '24px', transition: 'all 0.2s', borderColor: 'transparent' }}
            className="hover:shadow-lg hover:border-purple-200 border bg-white"
          >
            <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-colors">
              <FileSignature className="text-purple-600 group-hover:text-white" size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2">Mis Contratos</h3>
            <p className="text-sm text-gray-500">Accede a tus contratos de alquiler firmados y documentos.</p>
          </Card>
        </Link>

        <Link to="/tenant/payments" className="block group">
          <Card
            style={{ height: '100%', padding: '24px', transition: 'all 0.2s', borderColor: 'transparent' }}
            className="hover:shadow-lg hover:border-orange-200 border bg-white"
          >
            <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-600 transition-colors">
              <CreditCard className="text-orange-600 group-hover:text-white" size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2">Pagos y Recibos</h3>
            <p className="text-sm text-gray-500">Consulta tu historial de pagos o configura el pago automático.</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
