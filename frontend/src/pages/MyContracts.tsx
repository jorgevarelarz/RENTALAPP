import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ChevronRight, Mail } from 'lucide-react';
import { listContracts } from '../services/contracts';
import { listMyCoTenantInvites, type MyCoTenantInvite } from '../services/coTenants';
import { useAuth } from '../context/AuthContext';
import { ContractStatusBadge } from '../components/ContractStatusBadge';
import Card from '../components/ui/Card';
import PageHeader from '../components/ui/PageHeader';
import { formatApiError } from '../api/client';
import type { Contract } from '../types/contract';
import { getContractActionSummary } from '../utils/contractWorkflow';

type Group = { key: 'all' | 'progress' | 'current' | 'closed'; label: string; statuses: string[] };

const GROUPS: Group[] = [
  { key: 'all', label: 'Todos', statuses: [] },
  { key: 'progress', label: 'En trámite', statuses: ['draft', 'generated', 'pending_signature', 'signing'] },
  { key: 'current', label: 'Vigentes', statuses: ['signed', 'active'] },
  { key: 'closed', label: 'Cerrados', statuses: ['completed', 'cancelled', 'terminated'] },
];

type GroupKey = Group['key'];

const euroFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });

const secondaryLink =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50';

const formatDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString('es-ES');
};

const contractId = (c: Contract) => c._id || c.id || '';

const propertyOf = (c: Contract) => (typeof c.property === 'object' ? c.property : undefined);

const propertyTitle = (c: Contract) => {
  const property = propertyOf(c);
  return property?.title || property?.address || c.propertyAddress || 'Contrato de alquiler';
};

const propertyPlace = (c: Contract) => {
  const property = propertyOf(c);
  return [property?.address !== property?.title ? property?.address : '', property?.city].filter(Boolean).join(', ');
};

const myRoleOf = (c: Contract, userId: string) =>
  c.myRole || (String(c.ownerId) === userId ? 'landlord' : String(c.tenantId) === userId ? 'tenant' : undefined);

/** El co-titular no paga la fianza ni envía a firma: eso lo hace el inquilino principal. */
const nextActionFor = (c: Contract, role: string | undefined, userRole?: string) => {
  const summary = getContractActionSummary(c, userRole);
  if (role !== 'cotenant') return summary;
  if (c.status === 'signed' && !c.depositPaid) {
    return { ...summary, nextAction: 'El inquilino principal confirma la fianza', blockedReason: null };
  }
  return summary;
};

function InvitesCard({ invites }: { invites: MyCoTenantInvite[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="font-semibold text-gray-900">Invitaciones pendientes</h2>
        <p className="mt-0.5 text-sm text-gray-500">Te han invitado a compartir estos contratos como co-titular.</p>
      </div>
      <ul className="divide-y divide-gray-100">
        {invites.map((inv) => {
          const place = [inv.property?.address !== inv.property?.title ? inv.property?.address : '', inv.property?.city]
            .filter(Boolean)
            .join(', ');
          const expires = formatDate(inv.expiresAt);
          return (
            <li key={inv.partyId} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{inv.property?.title || inv.property?.address || 'Contrato de alquiler'}</p>
                {place && <p className="text-sm text-gray-500">{place}</p>}
                {inv.landlordName && <p className="mt-1 text-sm text-gray-600">Arrendador: {inv.landlordName}</p>}
                <p className="mt-2 flex items-start gap-1.5 text-sm text-gray-600 [overflow-wrap:anywhere]">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                  {inv.expired
                    ? 'El enlace ha caducado. Pide a quien te invitó que te envíe otro.'
                    : `Acepta desde el enlace que enviamos a ${inv.email}.`}
                </p>
              </div>
              <span className={`shrink-0 text-xs font-medium ${inv.expired ? 'text-red-700' : 'text-gray-500'}`}>
                {inv.expired ? 'Caducada' : expires ? `Caduca el ${expires}` : 'Pendiente'}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const MyContracts: React.FC = () => {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Contract[]>([]);
  const [invites, setInvites] = useState<MyCoTenantInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupKey>('all');

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!token || !user) return;
      try {
        setLoading(true);
        setError(null);
        const [r, pending] = await Promise.all([
          listContracts(token, { include: 'cotenant' }),
          // Las invitaciones son secundarias: si fallan (p. ej. identidad sin verificar), la lista se muestra igual.
          user.role === 'tenant' ? listMyCoTenantInvites().catch(() => []) : Promise.resolve([]),
        ]);
        if (!active) return;
        // La agencia y el admin no son parte de los contratos: el backend ya les filtra los suyos.
        const seesAll = user.role === 'agency' || user.role === 'admin';
        setItems((r.items || []).filter((c) => seesAll || myRoleOf(c, user._id)));
        setInvites(pending);
      } catch (e) {
        if (active) setError(formatApiError(e, 'No se pudieron cargar tus contratos'));
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [token, user]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        GROUPS.map((g) => [g.key, g.statuses.length ? items.filter((c) => g.statuses.includes(c.status)).length : items.length]),
      ) as Record<GroupKey, number>,
    [items],
  );

  const filtered = useMemo(() => {
    const statuses = GROUPS.find((g) => g.key === group)?.statuses ?? [];
    return statuses.length ? items.filter((c) => statuses.includes(c.status)) : items;
  }, [items, group]);

  if (!token || !user) return <div>Inicia sesión</div>;

  const isTenant = user.role === 'tenant';
  // La agencia gestora ve los contratos de los inmuebles que aún gestiona; no es parte de ninguno.
  const isAgency = user.role === 'agency';
  const cta = isTenant ? (
    <Link to="/properties" className={secondaryLink}>Buscar pisos</Link>
  ) : isAgency ? (
    <Link to="/agency/properties" className={secondaryLink}>Ver inmuebles</Link>
  ) : (
    <Link to="/owner/properties" className={secondaryLink}>Gestionar propiedades</Link>
  );

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Contratos"
        subtitle={
          isAgency
            ? 'Los contratos de los inmuebles que gestionas, su estado y el siguiente paso.'
            : 'Tus contratos de alquiler, su estado y el siguiente paso.'
        }
        cta={!loading && items.length === 0 && !error ? undefined : cta}
      />

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {invites.length > 0 && <InvitesCard invites={invites} />}

      {items.length > 1 && (
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              type="button"
              aria-pressed={group === g.key}
              onClick={() => setGroup(g.key)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                group === g.key
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-[var(--border)] bg-[var(--card)] text-gray-700 hover:bg-gray-50'
              }`}
            >
              {g.label} <span className={`tabular-nums ${group === g.key ? 'text-gray-300' : 'text-gray-400'}`}>{counts[g.key]}</span>
            </button>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="px-5 py-6 text-sm text-gray-500">Cargando contratos…</div>
        ) : error ? null : items.length === 0 ? (
          <div className="flex flex-col gap-4 px-5 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-gray-900">Aún no tienes contratos</p>
              <p className="mt-1 text-sm text-gray-500">
                {isTenant
                  ? 'Cuando el arrendador prepare tu contrato, o aceptes una invitación de co-titular, aparecerá aquí.'
                  : isAgency
                    ? 'Crea un contrato desde los candidatos de un inmueble que gestionas.'
                    : 'Crea un contrato desde la ficha de una de tus propiedades.'}
              </p>
            </div>
            {cta}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500">No hay contratos en este estado.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((c) => {
              const role = myRoleOf(c, user._id);
              const action = nextActionFor(c, role, user.role);
              const place = propertyPlace(c);
              const start = formatDate(c.signedAt || c.startDate);
              const end = formatDate(c.endDate);
              const counterpart = isAgency
                ? [c.landlordName && `Propietario: ${c.landlordName}`, c.tenantName && `Inquilino: ${c.tenantName}`]
                    .filter(Boolean)
                    .join(' · ')
                : role === 'landlord'
                  ? c.tenantName && `Inquilino: ${c.tenantName}`
                  : c.landlordName && `Arrendador: ${c.landlordName}`;
              return (
                <li key={contractId(c)}>
                  <Link
                    to={`/contracts/${contractId(c)}`}
                    className="group flex flex-col gap-3 px-5 py-4 hover:bg-gray-50 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">{propertyTitle(c)}</p>
                        {role === 'cotenant' && (
                          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">Co-titular</span>
                        )}
                      </div>
                      {place && <p className="text-sm text-gray-500">{place}</p>}
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                        {Number(c.rent) > 0 && (
                          <span className="tabular-nums">{euroFormatter.format(Number(c.rent))}/mes</span>
                        )}
                        {counterpart && <span>{counterpart}</span>}
                        {(start || end) && <span>{start || '—'} – {end || '—'}</span>}
                      </p>
                      <p className="mt-2 text-sm text-gray-600">
                        <span className="font-medium text-gray-900">Siguiente paso:</span> {action.nextAction}
                      </p>
                    </div>
                    <div className="order-first flex shrink-0 items-center gap-2 sm:order-none sm:flex-col sm:items-end">
                      <ContractStatusBadge status={c.status || 'draft'} />
                      <ChevronRight className="hidden h-4 w-4 text-gray-300 group-hover:text-gray-500 sm:block" aria-hidden="true" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default MyContracts;
