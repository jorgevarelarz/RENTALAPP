import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import { AlertCircle, ChevronRight, Clock3, Heart, ShieldCheck } from 'lucide-react';
import OnboardingChecklist from '../../components/OnboardingChecklist';
import { listContracts } from '../../services/contracts';
import { getFavorites } from '../../utils/favorites';
import { formatApiError } from '../../api/client';
import { getContractActionSummary, getContractStatusLabel } from '../../utils/contractWorkflow';
import type { Contract } from '../../types/contract';

type TenantSummary = {
  contracts: Contract[];
  favorites: number;
  loading: boolean;
  error: string;
};

const IN_PROGRESS = ['draft', 'generated', 'pending_signature', 'signing'];

const euroFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const formatEuros = (value: unknown) => euroFormatter.format(Number(value) || 0);

const primaryLink =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90';
const secondaryLink =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50';

const quickLinks = [
  { to: '/contracts', title: 'Contratos', detail: 'Borradores, firmas y documentos' },
  { to: '/tenant/payments', title: 'Pagos', detail: 'Rentas, recibos y fianza' },
  { to: '/tenant/applications', title: 'Solicitudes', detail: 'Pisos a los que has aplicado' },
  { to: '/tickets', title: 'Incidencias', detail: 'Averías y mantenimiento' },
];

const propertyOf = (contract: Contract) => (typeof contract.property === 'object' ? contract.property : undefined);

const propertyTitle = (contract: Contract) => {
  const property = propertyOf(contract);
  return property?.title || property?.address || contract.propertyAddress || 'Contrato de alquiler';
};

const propertyPlace = (contract: Contract) => {
  const property = propertyOf(contract);
  return [property?.address !== property?.title ? property?.address : '', property?.city].filter(Boolean).join(', ');
};

const contractId = (contract: Contract) => contract._id || contract.id || '';

function StatCard({
  to,
  icon,
  label,
  value,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <Link to={to} className="block rounded-xl transition-shadow hover:shadow-sm">
      <Card className="h-full p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
            <p className="mt-1 text-xs text-gray-500">{hint}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-2.5 text-gray-500" aria-hidden="true">
            {icon}
          </div>
        </div>
      </Card>
    </Link>
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

  const inProgress = useMemo(
    () => summary.contracts.filter((contract) => IN_PROGRESS.includes(contract?.status)),
    [summary.contracts],
  );

  const tenantProStatus = user?.tenantPro?.status || 'pending';
  const tenantProLabel = tenantProStatus === 'verified' ? 'Verificado' : tenantProStatus === 'rejected' ? 'Revisar' : 'Pendiente';

  const activeSummary = activeContract ? getContractActionSummary(activeContract, 'tenant') : null;
  const depositPending = activeContract ? !activeContract.depositPaid && Number(activeContract.deposit) > 0 : false;
  const loadingValue = '–';

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hola, {firstName}</h1>
          <p className="mt-1 text-gray-500">Tu alquiler, tus pagos y tus solicitudes, en un mismo sitio.</p>
        </div>
        <Link to="/properties" className={`${secondaryLink} self-start md:self-auto`}>
          Buscar pisos
        </Link>
      </div>

      <OnboardingChecklist role="tenant" />

      {summary.error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{summary.error}</span>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Tu alquiler</h2>
        </div>
        {summary.loading ? (
          <div className="px-5 py-6 text-sm text-gray-500">Cargando…</div>
        ) : activeContract && activeSummary ? (
          <div className="flex flex-col gap-5 px-5 py-5 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900">{propertyTitle(activeContract)}</p>
              {propertyPlace(activeContract) && (
                <p className="mt-0.5 text-sm text-gray-500">{propertyPlace(activeContract)}</p>
              )}
              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Renta</dt>
                  <dd className="font-semibold tabular-nums text-gray-900">{formatEuros(activeContract.rent)}/mes</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Estado</dt>
                  <dd className="font-semibold text-gray-900">{getContractStatusLabel(activeContract.status)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Fianza</dt>
                  <dd className="font-semibold text-gray-900">
                    {depositPending ? `${formatEuros(activeContract.deposit)} pendiente` : 'Pagada'}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-gray-600">
                <span className="font-medium text-gray-900">Siguiente paso:</span> {activeSummary.nextAction}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {depositPending && (
                <Link to={`/contracts/${contractId(activeContract)}`} className={primaryLink}>
                  Pagar fianza
                </Link>
              )}
              <Link to={`/contracts/${contractId(activeContract)}`} className={depositPending ? secondaryLink : primaryLink}>
                Ver contrato
              </Link>
              <Link to="/tenant/payments" className={secondaryLink}>
                Pagos
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-5 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-gray-900">Aún no tienes un alquiler activo</p>
              <p className="mt-1 text-sm text-gray-500">
                Cuando firmes un contrato verás aquí la renta, la fianza y el siguiente paso.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/properties" className={primaryLink}>
                Buscar pisos
              </Link>
              <Link to="/tenant/applications" className={secondaryLink}>
                Mis solicitudes
              </Link>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          to="/contracts"
          icon={<Clock3 size={20} />}
          label="Contratos en trámite"
          value={summary.loading ? loadingValue : inProgress.length}
          hint="Por revisar o firmar"
        />
        <StatCard
          to="/me/favorites"
          icon={<Heart size={20} />}
          label="Favoritos"
          value={summary.loading ? loadingValue : summary.favorites}
          hint="Viviendas guardadas"
        />
        <StatCard
          to="/tenant-pro"
          icon={<ShieldCheck size={20} />}
          label="Tenant PRO"
          value={tenantProLabel}
          hint={tenantProStatus === 'verified' ? 'Perfil listo para aplicar' : 'Completa la verificación'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="font-semibold text-gray-900">Contratos en trámite</h3>
          </div>
          {inProgress.length === 0 ? (
            <div className="px-5 py-6 text-sm text-gray-500">
              {summary.loading ? 'Cargando…' : 'No tienes contratos pendientes de firma.'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {inProgress.slice(0, 3).map((contract) => (
                <li key={contractId(contract)}>
                  <Link
                    to={`/contracts/${contractId(contract)}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-gray-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-900">{propertyTitle(contract)}</span>
                      <span className="block text-xs text-gray-500">
                        {getContractStatusLabel(contract.status)} · {getContractActionSummary(contract, 'tenant').nextAction}
                      </span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="font-semibold text-gray-900">Gestión rápida</h3>
          </div>
          <ul className="divide-y divide-gray-100">
            {quickLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-gray-50">
                  <span>
                    <span className="block font-medium text-gray-900">{link.title}</span>
                    <span className="block text-xs text-gray-500">{link.detail}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
