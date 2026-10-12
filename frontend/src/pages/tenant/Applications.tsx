import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ImageOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ProBadge from '../../components/ProBadge';
import { api as axios, formatApiError } from '../../api/client';
import { acceptApplicationVisit, proposeApplicationVisit } from '../../services/appointments';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import { toAbsoluteUrl } from '../../utils/media';
import { formatRent } from '../../utils/propertyDetail';
import {
  applicationStatus,
  canAccept,
  canPropose,
  localDateTimeMin,
  upcomingVisit,
  visitError,
  visitWhen,
  type TenantApplication,
  type Tone,
} from '../../utils/tenantApplications';

const secondaryLink =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50';
const primaryButton =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-[var(--ra-blue)] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3557e6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ra-blue)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButton =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60';

const TONE_CLASS: Record<Tone, string> = {
  action: 'text-amber-700',
  waiting: 'text-gray-600',
  done: 'text-[var(--ra-blue)]',
  closed: 'text-gray-500',
};

const contractLabel = (status?: string) => (status === 'pending_signature' ? 'Firmar contrato' : 'Ver contrato');

function ApplicationRow({ app, onChanged }: { app: TenantApplication; onChanged: () => Promise<void> }) {
  const [proposing, setProposing] = useState(false);
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const property = app.property;
  const photo = property?.images?.[0];
  const place = [property?.address, property?.city].filter(Boolean).join(', ');
  const status = applicationStatus(app);
  const closed = app.status === 'rejected';
  // Con una visita concertada por delante, proponer otra fecha es pedir un cambio
  const reschedule = app.status === 'scheduled' && !!upcomingVisit(app);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setProposing(false);
      setWhen('');
      await onChanged();
    } catch (e) {
      setError(visitError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitProposal = (e: React.FormEvent) => {
    e.preventDefault();
    const date = new Date(when);
    if (!when || Number.isNaN(date.getTime())) {
      setError('Elige día y hora.');
      return;
    }
    if (date.getTime() < Date.now()) {
      setError('Esa fecha ya ha pasado. Elige una a partir de ahora.');
      return;
    }
    // `datetime-local` es hora local sin zona; se manda el instante en ISO para que el servidor no lo reinterprete
    run(() => proposeApplicationVisit(app._id, date.toISOString()));
  };

  return (
    <li className="flex flex-col gap-4 px-5 py-5 sm:flex-row">
      <Link
        to={property?._id ? `/properties/${property._id}` : '/properties'}
        tabIndex={-1}
        aria-hidden="true"
        className="block h-24 w-full shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-20 sm:w-28"
      >
        {photo ? (
          <img src={toAbsoluteUrl(photo)} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-gray-400">
            <ImageOff size={20} aria-hidden="true" />
          </span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            {property?._id ? (
              <Link to={`/properties/${property._id}`} className="font-semibold text-gray-900 hover:underline [overflow-wrap:anywhere]">
                {property.title || 'Vivienda'}
              </Link>
            ) : (
              <p className="font-semibold text-gray-900">Anuncio retirado</p>
            )}
            {place && <p className="text-sm text-gray-500 [overflow-wrap:anywhere]">{place}</p>}
          </div>
          {Number(property?.price) > 0 && (
            <p className="shrink-0 text-gray-900">
              <span className="font-semibold tabular-nums">{formatRent(property?.price)}</span>
              <span className="text-sm text-gray-500"> /mes</span>
            </p>
          )}
        </div>

        <p className={`mt-2 text-sm font-medium ${TONE_CLASS[status.tone]}`}>{status.text}</p>

        {app.message && (
          <div className="mt-3 rounded-lg bg-[var(--ra-paper)] px-3 py-2">
            <p className="text-xs font-medium text-gray-500">Tu mensaje</p>
            <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm text-gray-700 [overflow-wrap:anywhere]">{app.message}</p>
          </div>
        )}

        {proposing ? (
          <form onSubmit={submitProposal} className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {reschedule ? 'Nueva fecha para la visita' : 'Día y hora que te viene bien'}
              <input
                type="datetime-local"
                value={when}
                min={localDateTimeMin()}
                onChange={(e) => setWhen(e.target.value)}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-gray-900"
                required
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className={primaryButton}>
                {reschedule ? 'Proponer cambio' : 'Enviar propuesta'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => { setProposing(false); setError(null); }}
                className={secondaryButton}
              >
                Cancelar
              </button>
            </div>
            {reschedule && (
              <p className="text-sm text-gray-500 sm:basis-full sm:order-last">
                Mientras el propietario no acepte la nueva fecha, sigue en pie la visita {visitWhen(app.visitDate)}.
              </p>
            )}
          </form>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {canAccept(app) && (
              <button type="button" disabled={busy} onClick={() => run(() => acceptApplicationVisit(app._id))} className={primaryButton}>
                Aceptar visita
              </button>
            )}
            {canPropose(app) && (
              <button type="button" disabled={busy} onClick={() => { setProposing(true); setError(null); }} className={secondaryButton}>
                {reschedule ? 'Cambiar fecha' : 'Proponer otra fecha'}
              </button>
            )}
            {app.contractId && (
              <Link to={`/contracts/${app.contractId}`} className={app.contractStatus === 'pending_signature' ? primaryButton : secondaryLink}>
                {contractLabel(app.contractStatus)}
              </Link>
            )}
            {!closed && property?.owner?._id && (
              <Link to={`/inbox/${property.owner._id}`} className={secondaryLink}>
                Escribir al propietario
              </Link>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

export default function TenantApplications() {
  const { user } = useAuth();
  const [items, setItems] = useState<TenantApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await axios.get('/api/applications/my');
    setItems(data.items || []);
  }, []);

  useEffect(() => {
    if (user?.role !== 'tenant') return;
    let active = true;
    setLoading(true);
    setError(null);
    load()
      .catch((e) => { if (active) setError(formatApiError(e, 'No se pudieron cargar tus solicitudes')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.role, load]);

  const isTenantPro = user?.role === 'tenant' && user?.tenantPro?.status === 'verified';
  const search = <Link to="/properties" className={secondaryLink}>Buscar pisos</Link>;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Solicitudes"
        subtitle="Las visitas que has pedido, las fechas que te proponen y en qué punto está cada una."
        cta={!loading && !error && items.length === 0 ? undefined : search}
      />
      {isTenantPro && <ProBadge maxRent={user?.tenantPro?.maxRent} />}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!error && (
        <Card className="overflow-hidden">
          {loading ? (
            <div className="px-5 py-6 text-sm text-gray-500">Cargando solicitudes…</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col gap-4 px-5 py-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-gray-900">Aún no has pedido ninguna visita</p>
                <p className="mt-1 text-sm text-gray-500">
                  Cuando solicites visitar un piso, verás aquí la fecha que te propone el propietario.
                </p>
              </div>
              {search}
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {items.map((app) => (
                <ApplicationRow key={app._id} app={app} onChanged={load} />
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
