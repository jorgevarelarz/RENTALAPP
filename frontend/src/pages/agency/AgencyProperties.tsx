import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import ApplicantsModal from '../../components/ApplicantsModal';
import { listAgencyProperties, type AgencyPropertyItem } from '../../services/agency';

const eur = (value?: number) =>
  typeof value === 'number' ? value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '';

const fmtDay = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function statusText(p: AgencyPropertyItem): { text: string; className: string } {
  if (p.hasActiveContract) return { text: 'Alquilado', className: 'text-gray-900' };
  if (p.status === 'active') return { text: 'Publicado', className: 'text-emerald-700' };
  if (p.status === 'archived') return { text: 'Archivado', className: 'text-gray-500' };
  return { text: 'Borrador', className: 'text-amber-700' };
}

/** Lo que espera ApplicantsModal (y el asistente de contratos al pulsar «Crear contrato»). */
const toModalProperty = (p: AgencyPropertyItem) => ({
  _id: p.id,
  title: p.title,
  address: p.address,
  city: p.city,
  price: p.price,
  deposit: p.deposit,
});

export default function AgencyProperties() {
  const [items, setItems] = useState<AgencyPropertyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [applicantsFor, setApplicantsFor] = useState<AgencyPropertyItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setItems(await listAgencyProperties());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // El correo de una solicitud nueva enlaza ?solicitudes=<inmueble>: abre sus candidatos una vez
  const [searchParams, setSearchParams] = useSearchParams();
  const applicantsParam = searchParams.get('solicitudes');
  useEffect(() => {
    if (!applicantsParam || loading) return;
    const property = items.find((p) => p.id === applicantsParam && p.agencyAccess === 'manage');
    if (property) setApplicantsFor(property);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('solicitudes');
      return next;
    }, { replace: true });
  }, [applicantsParam, loading, items, setSearchParams]);

  const managed = items.filter((p) => p.agencyAccess === 'manage');
  const transferred = items.filter((p) => p.agencyAccess !== 'manage');

  return (
    <div className="py-2 grid gap-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">Inmuebles</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Los inmuebles de tus propietarios. Mientras los gestionas, atiendes a los candidatos, propones visitas y preparas el contrato.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : loadError ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-700">No se pudieron cargar los inmuebles.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={load}>Reintentar</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="font-semibold text-gray-950">Todavía no gestionas ningún inmueble</p>
          <p className="mt-1 text-sm text-gray-500">
            Aparecerán aquí cuando un propietario que hayas dado de alta publique su vivienda contigo.
          </p>
          <Link to="/agency/landlords" className="inline-block mt-3 text-sm font-semibold text-[var(--ra-blue)] hover:underline">
            Ir a propietarios
          </Link>
        </div>
      ) : (
        <>
          <section aria-labelledby="agency-managed" className="grid gap-2">
            <h3 id="agency-managed" className="text-sm font-semibold text-gray-950">
              Gestionas {managed.length === 1 ? '1 inmueble' : `${managed.length} inmuebles`}
            </h3>
            {managed.length === 0 ? (
              <p className="text-sm text-gray-500">Has traspasado todos tus inmuebles a sus propietarios.</p>
            ) : (
              <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                {managed.map((p) => {
                  const status = statusText(p);
                  const apps = p.openApplications || 0;
                  return (
                    <li key={p.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center">
                      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                        <p className="font-semibold text-gray-950">{p.title || p.address || 'Inmueble sin título'}</p>
                        <p className="text-sm text-gray-500">{[p.address, p.city].filter(Boolean).join(', ')}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          <span className={`font-medium ${status.className}`}>{status.text}</span>
                          {p.price ? ` · ${eur(p.price)}/mes` : ''}
                          {p.ownerName ? ` · Propietario: ${p.ownerName}` : ''}
                          {p.hasActiveContract && p.lastPaidAt ? ` · Último cobro el ${fmtDay(p.lastPaidAt)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 md:justify-end">
                        {!p.hasActiveContract && (
                          <span className="text-sm text-gray-500">
                            {apps ? plural(apps, 'solicitud', 'solicitudes') : 'Sin solicitudes'}
                          </span>
                        )}
                        <Button
                          variant={apps && !p.hasActiveContract ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => setApplicantsFor(p)}
                          aria-label={`Ver candidatos de ${p.title || p.address || 'este inmueble'}`}
                        >
                          Candidatos
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {transferred.length > 0 && (
            <section aria-labelledby="agency-transferred" className="grid gap-2">
              <h3 id="agency-transferred" className="text-sm font-semibold text-gray-950">Traspasados al propietario</h3>
              <p className="text-sm text-gray-500">
                Los gestiona su propietario. Ves si siguen alquilados para el cálculo de tus comisiones.
              </p>
              <ul className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
                {transferred.map((p) => (
                  <li key={p.id} className="p-4 [overflow-wrap:anywhere]">
                    <p className="font-medium text-gray-900">{p.title || p.address || 'Inmueble sin título'}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {[p.city, p.hasActiveContract ? 'Alquilado' : 'Sin contrato activo'].filter(Boolean).join(' · ')}
                      {p.agencyTransferredAt ? ` · Traspasado el ${fmtDay(p.agencyTransferredAt)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {applicantsFor && (
        <ApplicantsModal
          property={toModalProperty(applicantsFor)}
          isOpen={!!applicantsFor}
          onClose={() => {
            setApplicantsFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}
