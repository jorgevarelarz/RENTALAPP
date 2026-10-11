import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { getPropertyApplications, type Application } from '../services/properties';
import { acceptApplicationVisit, proposeApplicationVisit } from '../services/appointments';
import { useToast } from '../context/ToastContext';

interface Props {
  property: any;
  isOpen: boolean;
  onClose: () => void;
}

const VISIT_ERRORS: Record<string, string> = {
  invalid_visit_date: 'La fecha de la visita no es válida.',
  visitDate_required: 'Elige día y hora para la visita.',
  forbidden: 'Solo el propietario del inmueble o la agencia que lo gestiona pueden proponer visitas.',
  application_not_found: 'Esta solicitud ya no existe.',
  no_proposed_date: 'No hay ninguna fecha propuesta que aceptar.',
};

const visitError = (error: any) =>
  VISIT_ERRORS[error?.response?.data?.error] || 'No se pudo guardar la visita. Inténtalo de nuevo.';

const fmtDate = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
};

function statusLabel(app: Application): { text: string; className: string } {
  if (app.status === 'scheduled') {
    return { text: `Visita el ${fmtDate(app.visitDate)}`, className: 'text-[var(--ra-blue)]' };
  }
  if (app.status === 'proposed') {
    const who = app.proposedBy === 'tenant' ? 'El candidato propone' : 'Has propuesto';
    return { text: `${who} visita el ${fmtDate(app.proposedDate)}`, className: 'text-amber-700' };
  }
  if (app.status === 'rejected') return { text: 'Descartada', className: 'text-gray-500' };
  return { text: 'Sin visita', className: 'text-gray-500' };
}

export default function ApplicantsModal({ property, isOpen, onClose }: Props) {
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [schedulingApp, setSchedulingApp] = useState<string | null>(null);
  const [visitDate, setVisitDate] = useState('');
  const [busy, setBusy] = useState(false);

  const nav = useNavigate();
  const { push } = useToast();

  useEffect(() => {
    if (isOpen && property?._id) {
      loadApplicants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, property?._id]);

  const loadApplicants = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const data = await getPropertyApplications(property._id);
      const items = Array.isArray(data) ? data : data.items || [];
      // Una solicitud cuyo inquilino ya no existe no se puede gestionar
      setApplicants(items.filter((a) => a?.tenant?._id));
    } catch {
      setApplicants([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleVisit = async () => {
    if (!schedulingApp || !visitDate) return;
    const when = new Date(visitDate);
    if (Number.isNaN(when.getTime())) {
      push({ title: VISIT_ERRORS.invalid_visit_date, tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      // `datetime-local` es hora local sin zona; se manda el instante en UTC para que el servidor no lo reinterprete
      await proposeApplicationVisit(schedulingApp, when.toISOString());
      push({ title: `Visita propuesta para el ${fmtDate(when.toISOString())}`, tone: 'success' });
      setSchedulingApp(null);
      setVisitDate('');
      await loadApplicants();
    } catch (e) {
      push({ title: visitError(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptVisit = async (app: Application) => {
    setBusy(true);
    try {
      await acceptApplicationVisit(app._id);
      push({ title: 'Visita aceptada', tone: 'success' });
      await loadApplicants();
    } catch (e) {
      push({ title: visitError(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateContract = (app: Application) => {
    onClose();
    nav('/contracts/new', {
      state: {
        propertyId: property._id,
        tenantId: app.tenant._id,
        initialData: {
          address: property.address,
          city: property.city,
          rentAmount: property.price,
          depositAmount: property.deposit,
          tenantName: app.tenant.name,
          tenantEmail: app.tenant.email,
        },
      },
    });
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={property?.title ? `Candidatos · ${property.title}` : 'Candidatos'}
      className="max-h-[90vh] overflow-y-auto"
    >
      <div className="min-h-[160px]">
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Cargando candidatos…</p>
        ) : loadError ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-700">No se pudieron cargar los candidatos.</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={loadApplicants}>
              Reintentar
            </Button>
          </div>
        ) : applicants.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">Aún no hay solicitudes para este inmueble.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {applicants.map((app) => {
              const status = statusLabel(app);
              const canAccept = app.status === 'proposed' && app.proposedBy === 'tenant';
              return (
                <li key={app._id} className="py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0 [overflow-wrap:anywhere]">
                    <p className="font-medium text-gray-900">{app.tenant.name || app.tenant.email}</p>
                    <p className="text-sm text-gray-500">{app.tenant.email}</p>
                    <p className="mt-1 text-xs">
                      <span className={`font-medium ${status.className}`}>{status.text}</span>
                      {app.tenant.tenantPro?.status === 'verified' && (
                        <span className="text-green-700"> · Solvencia verificada</span>
                      )}
                    </p>
                  </div>

                  {app.message && (
                    <p className="mt-3 border-l-2 border-gray-200 pl-3 text-sm text-gray-600 [overflow-wrap:anywhere]">
                      {app.message}
                    </p>
                  )}

                  {schedulingApp === app._id ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`visit-${app._id}`}>
                        Día y hora de la visita
                      </label>
                      <input
                        id={`visit-${app._id}`}
                        type="datetime-local"
                        className="auth-input !w-auto text-sm"
                        value={visitDate}
                        onChange={(e) => setVisitDate(e.target.value)}
                      />
                      <Button size="sm" onClick={handleScheduleVisit} disabled={!visitDate || busy}>
                        Proponer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSchedulingApp(null);
                          setVisitDate('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {canAccept && (
                        <Button variant="secondary" size="sm" disabled={busy} onClick={() => handleAcceptVisit(app)}>
                          Aceptar visita
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => setSchedulingApp(app._id)}>
                        {app.status === 'scheduled' || app.status === 'proposed' ? 'Cambiar visita' : 'Proponer visita'}
                      </Button>
                      <Button size="sm" onClick={() => handleCreateContract(app)}>
                        Crear contrato
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
