import React, { useCallback, useEffect, useState } from 'react';
import { api as axios } from '../api/client';
import { Link } from 'react-router-dom';
import { createProperty, listProperties } from '../services/properties';
import { listContracts } from '../services/contracts';
import { userService } from '../services/user';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import PropertyFormRHF, { PropertyFormData } from '../components/PropertyFormRHF';
import ApplicantsModal from '../components/ApplicantsModal';
import { AlertTriangle, ChevronRight, Plus, Home, Image as ImageIcon, Users } from 'lucide-react';
import { toAbsoluteUrl } from '../utils/media';
import OnboardingChecklist from '../components/OnboardingChecklist';
import { buildLandlordAlerts, estimateMonthlyRent, propertyPhotoCount } from '../utils/landlordDashboard';
import { getContractActionSummary } from '../utils/contractWorkflow';

const IconCash = () => (
  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconHome = () => (
  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const IconDoc = () => (
  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" />
  </svg>
);

const euroFormatter = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const formatEuros = (value: unknown) => euroFormatter.format(Number(value) || 0);

const formatShortDate = (value: unknown) => {
  if (!value) return '';
  const date = new Date(value as string);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

const plural = (count: number, singular: string, pluralForm: string) => `${count} ${count === 1 ? singular : pluralForm}`;

const quickLinks = [
  { to: '/contracts', title: 'Contratos', detail: 'Borradores, firmas y contratos activos' },
  { to: '/landlord/payments', title: 'Pagos', detail: 'Rentas cobradas y recibos pendientes' },
  { to: '/landlord/showings', title: 'Visitas', detail: 'Citas con interesados' },
  { to: '/landlord/issues', title: 'Incidencias', detail: 'Averías y mantenimiento abiertos' },
];

const LandlordDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [mine, setMine] = useState<any[]>([]);
  const [actionContracts, setActionContracts] = useState<any[]>([]);
  const [rentedByProperty, setRentedByProperty] = useState<Record<string, { tenantName?: string; endDate?: string }>>({});
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any | null>(null);
  const [showApplicantsFor, setShowApplicantsFor] = useState<any>(null);
  const { push } = useToast();

  const refresh = useCallback(async () => {
    const all = await listProperties({ limit: 200, sort: 'createdAt', dir: 'desc' });
    const ownerId = String(user?._id || '');
    const myProps = all.filter((p: any) => {
      const owner = p.ownerId || p.owner;
      return owner && String(owner) === ownerId;
    });
    setMine(myProps);
    if (token) {
      try {
        const [{ items }, ...inProgress] = await Promise.all(
          ['active', 'pending_signature', 'signing', 'signed'].map(status => listContracts(token, { status, limit: 50 })),
        );
        const map: Record<string, { tenantName?: string; endDate?: string }> = {};
        items.forEach((c: any) => {
          const propId = c.property?._id || c.propertyId || c.property;
          if (!propId) return;
          map[String(propId)] = {
            tenantName: c.tenantName || c.tenant?.name,
            endDate: c.endDate,
          };
        });
        setActionContracts([...inProgress.flatMap(r => r.items), ...items]);
        setRentedByProperty(map);
      } catch {
        setActionContracts([]);
        setRentedByProperty({});
      }
    } else {
      setActionContracts([]);
      setRentedByProperty({});
    }
  }, [user, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    userService
      .getLandlordStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  const handleUpload = async (files: File[]): Promise<string[]> => {
    if (!token || !files.length) return [];
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    const res = await axios.post('/api/uploads/images', form, { headers: { Authorization: `Bearer ${token}` } });
    return res.data.urls || [];
  };

  const handleSubmit = async (data: PropertyFormData) => {
    if (!token) return;
    try {
      const payload: any = { ...data, owner: user?._id };
      if (editingProperty) {
        await axios.put(`/api/properties/${editingProperty._id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
        push({ title: 'Propiedad actualizada', tone: 'success' });
      } else {
        await createProperty(token, payload);
        push({ title: 'Propiedad creada correctamente', tone: 'success' });
      }
      setIsModalOpen(false);
      setEditingProperty(null);
      await refresh();
    } catch (e: any) {
      push({ title: e.response?.data?.message || 'Error al guardar', tone: 'error' });
    }
  };

  const openCreate = () => {
    setEditingProperty(null);
    setIsModalOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingProperty(p);
    setIsModalOpen(true);
  };

  const getPublishReadiness = (property: any) => {
    const imageCount = propertyPhotoCount(property);
    const hasMinPhotos = imageCount >= 3;
    const hasPrice = Number(property.price || 0) >= 100;
    const hasAddress = Boolean(property.address && property.city);
    // Only the photo minimum blocks publishing (backend: min_images_3); price/address are advice.
    const isReady = hasMinPhotos;

    return {
      imageCount,
      hasMinPhotos,
      hasPrice,
      hasAddress,
      isReady,
      label: isReady ? 'Lista para publicar' : 'Faltan fotos para publicar',
      nextAction: !hasMinPhotos ? 'Subir al menos 3 fotos' : hasPrice && hasAddress ? 'Publicar anuncio' : 'Revisar precio y dirección',
    };
  };

  const activeProps = mine.filter(p => p.status === 'active' && !rentedByProperty[String(p._id)]).length;
  const draftProps = mine.filter(p => p.status !== 'active').length;
  const landlordAlerts = buildLandlordAlerts(mine);
  const nextActions = actionContracts
    .map((contract: any) => ({
      id: contract._id,
      propertyTitle: contract.property?.title || contract.propertyAddress || contract.address || 'Contrato',
      summary: getContractActionSummary(contract, user?.role),
    }))
    .filter(({ summary }) => summary.tone !== 'neutral')
    .slice(0, 3);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel de propietario</h1>
          <p className="text-gray-500 mt-1">Gestiona inmuebles e ingresos desde aquí.</p>
        </div>
        <Button onClick={openCreate} className="inline-flex items-center gap-2 self-start md:self-auto whitespace-nowrap">
          <Plus size={18} aria-hidden="true" /> Nueva propiedad
        </Button>
      </div>

      <OnboardingChecklist role="landlord" />

      {landlordAlerts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {landlordAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                alert.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-blue-200 bg-blue-50 text-blue-900'
              }`}
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{alert.title}</p>
                <p className="mt-1 text-sm opacity-80">{alert.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {statsLoading ? (
        <div className="p-6 flex justify-center"><Spinner /></div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">Ingresos cobrados</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{formatEuros(stats.earnings)}</p>
                  <p className="text-xs text-gray-500 mt-1">Pagos confirmados por Stripe</p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg" aria-hidden="true">
                  <IconCash />
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">Propiedades</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.properties?.total ?? mine.length}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {plural(activeProps, 'publicada', 'publicadas')} · {plural(draftProps, 'borrador', 'borradores')} ·{' '}
                    {plural(stats.properties?.rented ?? 0, 'alquilada', 'alquiladas')}
                  </p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg" aria-hidden="true">
                  <IconHome />
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500">Contratos en trámite</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stats.contracts?.pending ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Pendientes de firma o de activar</p>
                </div>
                <div className="p-2.5 bg-gray-50 rounded-lg" aria-hidden="true">
                  <IconDoc />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:items-start">
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Últimos pagos recibidos</h3>
                <Link to="/landlord/payments" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                  Ver todos
                </Link>
              </div>

              {(stats.recentPayments ?? []).length === 0 ? (
                <div className="px-5 py-8 text-sm text-center text-gray-500">Todavía no has recibido pagos.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {stats.recentPayments.map((payment: any) => {
                    const dateLabel = formatShortDate(payment.date);
                    return (
                      <li key={payment.id} className="px-5 py-3 flex justify-between items-center gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{payment.concept || 'Pago'}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {[payment.propertyName, dateLabel].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums text-gray-900 whitespace-nowrap">{formatEuros(payment.amount)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900">Gestión rápida</h3>
              </div>
              <ul className="divide-y divide-gray-100">
                {quickLinks.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <span>
                        <span className="block font-medium text-gray-900">{link.title}</span>
                        <span className="block text-xs text-gray-500">{link.detail}</span>
                      </span>
                      <ChevronRight size={16} className="text-gray-400 shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      ) : (
        <Card className="p-6 text-center text-gray-500">No se pudieron cargar las estadísticas.</Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Siguiente acción</h3>
          <p className="text-sm text-gray-500 mt-1">Contratos en curso y sus próximos pasos.</p>
        </div>
        {nextActions.length === 0 ? (
          <div className="px-5 py-4 text-sm text-gray-500">No hay contratos con acciones pendientes.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {nextActions.map(({ id, propertyTitle, summary }) => (
              <div key={id} className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">{propertyTitle}</div>
                  <div className="text-sm text-gray-700 mt-1">{summary.nextAction}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {summary.detail}
                    {summary.blockedReason ? ` · Bloqueo: ${summary.blockedReason}` : ''}
                  </div>
                </div>
                <Link to={`/contracts/${id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                  Abrir contrato
                </Link>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Mis propiedades</h3>
        </div>

        {mine.length === 0 ? (
          <div className="p-16 text-center">
            <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Home size={32} />
            </div>
            <h4 className="text-lg font-medium text-gray-900">Aún no tienes propiedades</h4>
            <p className="text-gray-500 mb-6">Crea tu primer anuncio en menos de 2 minutos.</p>
            <Button variant="secondary" onClick={openCreate}>Empezar ahora</Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {mine.map((p: any) => {
              const rented = rentedByProperty[String(p._id)];
              const priceEstimate = estimateMonthlyRent(p);
              const priceDiff = priceEstimate && p.price
                ? Math.round(((Number(p.price) - priceEstimate) / priceEstimate) * 100)
                : null;
              const readiness = getPublishReadiness(p);
              const statusLabel = rented
                ? 'Alquilado'
                : p.status === 'active'
                  ? 'Publicado'
                  : 'Borrador';
              const statusClass = rented
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : p.status === 'active'
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200';
              const endLabel = rented?.endDate
                ? new Date(rented.endDate).toLocaleDateString('es-ES')
                : '';
              return (
              <div key={p._id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 relative">
                    {(p.images?.[0] || p.photos?.[0]) ? (
                      <img src={toAbsoluteUrl(p.images?.[0] || p.photos?.[0])} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400"><ImageIcon size={24} /></div>
                    )}
                    {p.onlyTenantPro && (
                      <div className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-[10px] font-bold text-center py-0.5">Tenant PRO</div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{p.title}</h4>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{p.address}, {p.city}</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">{formatEuros(p.price)}/mes</p>
                    {priceEstimate && (
                      <p className="text-xs text-gray-500 mt-1">
                        Estimación inicial: {priceEstimate.toLocaleString('es-ES')} €/mes
                        {priceDiff !== null && Math.abs(priceDiff) > 20 ? ` · revisar (${priceDiff > 0 ? '+' : ''}${priceDiff}%)` : ''}
                      </p>
                    )}
                    {!rented && p.status !== 'active' && (
                      <div className={`mt-2 inline-flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                        readiness.isReady
                          ? 'border-green-200 bg-green-50 text-green-800'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}>
                        <span className="font-semibold">{readiness.label}</span>
                        <span>Fotos {readiness.imageCount}/3</span>
                        <span>{readiness.hasPrice ? 'Precio ok' : 'Falta precio'}</span>
                        <span>{readiness.hasAddress ? 'Dirección ok' : 'Falta dirección'}</span>
                        <span className="font-medium">Siguiente paso: {readiness.nextAction}</span>
                      </div>
                    )}
                    {rented && (
                      <p className="text-xs text-gray-500 mt-1">
                        Alquilado por {rented.tenantName || 'Inquilino'}{endLabel ? ` · Hasta ${endLabel}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {(p.status === 'active' || p.status === 'rented') && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowApplicantsFor(p)}
                      className="flex items-center gap-1"
                    >
                      <Users size={16} /> Solicitudes
                    </Button>
                  )}
                  {p.status !== 'active' && (
                    <Button
                      variant="primary" size="sm"
                      onClick={async () => {
                        if (!token) return;
                        try {
                          await axios.post(`/api/properties/${p._id}/publish`, {}, { headers: { Authorization: `Bearer ${token}` } });
                          await refresh();
                          push({ title: 'Propiedad publicada', tone: 'success' });
                        } catch (e: any) {
                          const msg = e?.response?.data?.error === 'min_images_3'
                            ? 'Sube al menos 3 fotos para publicar.'
                            : 'Error al publicar';
                          push({ title: msg, tone: 'error' });
                        }
                      }}
                      disabled={!readiness.isReady}
                      className={!readiness.isReady ? "opacity-50 cursor-not-allowed" : ""}
                      title={!readiness.isReady ? readiness.nextAction : "Publicar ahora"}
                    >
                      Publicar
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>Editar</Button>
                  <Button variant="ghost" size="sm" className="hover:bg-red-50" style={{ color: '#b91c1c' }} onClick={async () => {
                    if (!window.confirm(`¿Eliminar «${p.title || 'esta propiedad'}»? Esta acción no se puede deshacer.`)) return;
                    await axios.delete(`/api/properties/${p._id}`, { headers: { Authorization: `Bearer ${token}` } });
                    await refresh();
                    push({ title: 'Eliminada', tone: 'success' });
                  }}>Borrar</Button>
                </div>
              </div>
            )})}
          </div>
        )}
      </Card>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProperty ? "Editar propiedad" : "Nueva propiedad"}>
        <div className="pt-2">
          <PropertyFormRHF
            onSubmit={handleSubmit}
            onUploadPhotos={handleUpload}
            defaultValues={editingProperty ? {
              ...editingProperty,
              location: {
                lat: editingProperty.location?.coordinates?.[1] || 40.4168,
                lng: editingProperty.location?.coordinates?.[0] || -3.7038,
              },
              availableFrom: editingProperty.availableFrom ? String(editingProperty.availableFrom).slice(0,10) : undefined,
              images: editingProperty.images || editingProperty.photos || [],
            } : undefined}
          />
        </div>
      </Modal>

      <ApplicantsModal
        isOpen={!!showApplicantsFor}
        onClose={() => setShowApplicantsFor(null)}
        property={showApplicantsFor}
      />
    </div>
  );
};

export default LandlordDashboard;
