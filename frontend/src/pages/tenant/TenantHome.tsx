import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import ProBadge from '../../components/ui/ProBadge';
import { useAuth } from '../../context/AuthContext';
import { listApplications } from '../../api/applications';
import { listContracts } from '../../api/contracts';
import { listIncidents } from '../../api/incidents';
import { getTenantProInfo, TenantProInfo } from '../../api/tenantPro';
import { listProperties } from '../../api/properties';
import type { Application } from '@rental-app/types/applications';
import type { Incident } from '@rental-app/types/incidents';

type ContractSummary = {
  id: string;
  property: string;
  status: string;
  rent?: number;
  nextPaymentAt?: string;
  updatedAt?: string;
};

type RecommendedProperty = {
  id: string;
  title: string;
  city?: string;
  price?: number;
  onlyTenantPro?: boolean;
};

type ProStatusKey = 'none' | 'pending' | 'verified' | 'rejected';

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' });

const applicationStatusLabel: Record<string, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  visited: 'Visita',
};

const contractStatusLabel: Record<string, string> = {
  draft: 'Borrador',
  in_review: 'Revisión',
  signing: 'En firma',
  signed: 'Firmado',
  active: 'Activo',
  completed: 'Completado',
};

const incidentStatusLabel: Record<string, string> = {
  OPEN: 'Abierta',
  open: 'Abierta',
  QUOTE: 'Presupuesto',
  quote: 'Presupuesto',
  ESCROW: 'En depósito',
  IN_PROGRESS: 'En curso',
  in_progress: 'En curso',
  EXTRA_REQUESTED: 'Extra solicitado',
  extra_requested: 'Extra solicitado',
  DONE: 'Resuelta',
  done: 'Resuelta',
  DISPUTE: 'En disputa',
  dispute: 'En disputa',
  CLOSED: 'Cerrada',
  closed: 'Cerrada',
  quoted: 'Presupuesto',
  awaiting_schedule: 'Pendiente de cita',
  awaiting_validation: 'Pendiente de validación',
};

const proStatusInfo: Record<ProStatusKey, { label: string; helper: string; tone: 'default' | 'new' | 'highlight' }> = {
  none: {
    label: 'Sin iniciar',
    helper: 'Obtén documentación para optar a viviendas Only PRO.',
    tone: 'default',
  },
  pending: {
    label: 'En revisión',
    helper: 'Estamos validando tu documentación. Te avisaremos en breve.',
    tone: 'new',
  },
  verified: {
    label: 'Verificado',
    helper: 'Tu solvencia está aprobada. Accede a viviendas Only PRO.',
    tone: 'highlight',
  },
  rejected: {
    label: 'Rechazado',
    helper: 'Revisa el correo con los motivos y vuelve a solicitarlo cuando quieras.',
    tone: 'default',
  },
};

const quickLinks: Array<{ to: string; label: string }> = [
  { to: '/properties', label: 'Buscar pisos' },
  { to: '/tenant/applications', label: 'Ver solicitudes' },
  { to: '/tenant/payments', label: 'Pagos y recibos' },
  { to: '/tickets', label: 'Mis incidencias' },
  { to: '/tenant-pro', label: 'Gestionar Tenant PRO' },
  { to: '/profile', label: 'Perfil y cuenta' },
];

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  color: '#64748b',
  marginBottom: 6,
};

const statValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  margin: 0,
};

const statHintStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 12,
  color: '#64748b',
  lineHeight: 1.4,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 600,
};

const sectionHintStyle: React.CSSProperties = {
  margin: '4px 0 0',
  fontSize: 13,
  color: '#64748b',
};

const sectionLinkStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#4f46e5',
  textDecoration: 'none',
  fontWeight: 500,
};

const quickLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid #cbd5f5',
  textDecoration: 'none',
  fontWeight: 500,
  background: '#fff',
  color: '#0f172a',
};

const tileStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '12px 14px',
  background: '#fff',
};

const mapContractToSummary = (input: any): ContractSummary => {
  const id = input?._id || input?.id;
  const property = input?.propertyTitle || input?.property?.title || input?.property || 'Contrato';
  const status = String(input?.status || 'draft').toLowerCase();
  const rentSource = input?.rent ?? input?.rentAmount ?? input?.price;
  const rent = Number.isFinite(Number(rentSource)) ? Number(rentSource) : undefined;
  const nextPaymentAt = input?.nextRentDueAt || input?.nextPaymentAt || input?.nextChargeAt || input?.lastPaidAt;
  const updatedAt = input?.updatedAt || input?.lastUpdate || input?.createdAt;
  return {
    id: id ? String(id) : String(property),
    property: String(property),
    status,
    rent,
    nextPaymentAt: nextPaymentAt ? String(nextPaymentAt) : undefined,
    updatedAt: updatedAt ? String(updatedAt) : undefined,
  };
};

const mapPropertyToRecommendation = (input: any): RecommendedProperty => {
  const id = input?._id || input?.id;
  const priceSource = input?.price ?? input?.rent ?? input?.rentAmount;
  const numericPrice = Number(priceSource);
  return {
    id: id ? String(id) : String(Math.random()),
    title: String(input?.title || input?.name || 'Propiedad'),
    city: input?.city ? String(input.city) : undefined,
    price: Number.isFinite(numericPrice) ? numericPrice : undefined,
    onlyTenantPro: !!input?.onlyTenantPro,
  };
};

const mapApplicationFromApi = (input: any): Application => {
  const id = input?.id || input?._id || Math.random().toString(16).slice(2);
  const property = input?.property;
  return {
    id: String(id),
    propertyId: String(input?.propertyId || property?._id || ''),
    status: String(input?.status || 'pending') as Application['status'],
    visitDate: input?.visitDate ? String(input.visitDate) : undefined,
    createdAt: input?.createdAt ? String(input.createdAt) : new Date().toISOString(),
    property: property
      ? {
          _id: property._id ? String(property._id) : undefined,
          title: property.title,
          city: property.city,
          price: typeof property.price === 'number' ? property.price : undefined,
          owner: property.owner ? String(property.owner) : undefined,
          onlyTenantPro: !!property.onlyTenantPro,
        }
      : null,
  };
};

const mapIncidentFromApi = (input: any): Incident => {
  const id = input?._id || input?.id;
  return {
    id: id ? String(id) : `ticket-${Date.now()}`,
    propertyId: input?.propertyId ? String(input.propertyId) : undefined,
    title: input?.title ? String(input.title) : undefined,
    status: String(input?.status || 'OPEN') as Incident['status'],
    service: input?.service ? String(input.service) : undefined,
    createdAt: input?.createdAt ? String(input.createdAt) : new Date().toISOString(),
    updatedAt: input?.updatedAt ? String(input.updatedAt) : undefined,
    ownerId: input?.ownerId ? String(input.ownerId) : undefined,
    openedBy: input?.openedBy ? String(input.openedBy) : undefined,
    proId: input?.proId ? String(input.proId) : input?.pro?.id ? String(input.pro.id) : null,
  };
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return dateFormatter.format(parsed);
};

const applicationTone = (status: string): 'default' | 'new' | 'highlight' => {
  if (status === 'accepted') return 'highlight';
  if (status === 'pending') return 'new';
  return 'default';
};

const contractTone = (status: string): 'default' | 'new' | 'highlight' => {
  if (status === 'active' || status === 'signed') return 'highlight';
  if (status === 'signing' || status === 'in_review') return 'new';
  return 'default';
};

const incidentTone = (status: string): 'default' | 'new' | 'highlight' => {
  const upper = status.toUpperCase();
  if (upper === 'ESCROW' || upper === 'DISPUTE') return 'highlight';
  if (upper === 'OPEN' || upper === 'IN_PROGRESS' || status === 'awaiting_schedule' || status === 'awaiting_validation') return 'new';
  return 'default';
};

const toProStatus = (value?: TenantProInfo['status']): ProStatusKey => {
  if (value === 'pending' || value === 'verified' || value === 'rejected') return value;
  return 'none';
};

export default function TenantHome() {
  const { token, user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsTotal, setApplicationsTotal] = useState(0);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [contractsTotal, setContractsTotal] = useState(0);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentsTotal, setIncidentsTotal] = useState(0);
  const [proInfo, setProInfo] = useState<TenantProInfo | null>(null);
  const [properties, setProperties] = useState<RecommendedProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const problems: string[] = [];
      try {
        const [appsRes, contractsRes, incidentsRes, proRes, propsRes] = await Promise.allSettled([
          listApplications(token, { limit: 10 }),
          listContracts(token),
          listIncidents('tenant', token, { limit: 10 }),
          getTenantProInfo(),
          listProperties({ limit: 6, sort: 'createdAt', dir: 'desc' }),
        ]);

        if (cancelled) return;

        if (appsRes.status === 'fulfilled') {
          const payload = appsRes.value as any;
          const raw = Array.isArray(payload) ? payload : payload?.items;
          const mapped = Array.isArray(raw) ? raw.map(mapApplicationFromApi) : [];
          setApplications(mapped);
          const total = typeof payload?.total === 'number' ? Number(payload.total) : mapped.length;
          setApplicationsTotal(total);
        } else {
          problems.push('solicitudes');
          setApplications([]);
          setApplicationsTotal(0);
        }

        if (contractsRes.status === 'fulfilled') {
          const contractsPayload = contractsRes.value as any;
          const raw = contractsPayload?.items ?? (Array.isArray(contractsPayload) ? contractsPayload : []);
          const mapped = Array.isArray(raw) ? raw.map(mapContractToSummary) : [];
          setContracts(mapped);
          const total = typeof contractsPayload?.total === 'number' ? Number(contractsPayload.total) : mapped.length;
          setContractsTotal(total);
        } else {
          problems.push('contratos');
          setContracts([]);
          setContractsTotal(0);
        }

        if (incidentsRes.status === 'fulfilled') {
          const payload = incidentsRes.value as any;
          const raw = Array.isArray(payload) ? payload : payload?.items;
          const mapped = Array.isArray(raw) ? raw.map(mapIncidentFromApi) : [];
          setIncidents(mapped);
          const total = typeof payload?.total === 'number' ? Number(payload.total) : mapped.length;
          setIncidentsTotal(total);
        } else {
          problems.push('incidencias');
          setIncidents([]);
          setIncidentsTotal(0);
        }

        if (proRes.status === 'fulfilled') {
          setProInfo(proRes.value ?? null);
        } else {
          setProInfo(null);
        }

        if (propsRes.status === 'fulfilled') {
          const list = Array.isArray(propsRes.value) ? propsRes.value : [];
          setProperties(list.map(mapPropertyToRecommendation));
        } else {
          setProperties([]);
        }

        if (problems.length > 0) {
          const label = problems.join(', ');
          setError(`Algunos datos (${label}) no se pudieron cargar. Inténtalo de nuevo más tarde.`);
        }
      } catch (err: any) {
        if (!cancelled) {
          const message = err?.message || 'No se pudo cargar el panel del inquilino.';
          setError(message);
          setApplications([]);
          setContracts([]);
          setIncidents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const proStatus = toProStatus(proInfo?.status);
  const pendingApplications = useMemo(() => applications.filter(item => item.status === 'pending').length, [applications]);
  const activeContracts = useMemo(
    () => contracts.filter(item => ['active', 'signed', 'signing'].includes(item.status)).length,
    [contracts],
  );
  const openIncidents = useMemo(
    () => incidents.filter(item => {
      const upper = item.status.toUpperCase();
      return upper !== 'CLOSED' && upper !== 'DONE';
    }).length,
    [incidents],
  );
  const recommended = useMemo(() => {
    if (!properties.length) return [];
    const filtered = properties.filter(item => (proStatus === 'verified' ? true : !item.onlyTenantPro));
    return filtered.slice(0, 3);
  }, [properties, proStatus]);

  if (!user) {
    return <div>Inicia sesión para ver tu panel de inquilino.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h2 style={{ marginBottom: 4 }}>Tu panel como inquilino</h2>
        <p style={{ margin: 0, color: '#475569' }}>
          Resume solicitudes, contratos, incidencias y tu estado Tenant PRO desde un único lugar.
        </p>
      </header>

      {loading && (
        <div style={{ border: '1px solid #cbd5f5', background: '#eef2ff', color: '#4338ca', borderRadius: 12, padding: '10px 14px' }}>
          Actualizando datos del panel…
        </div>
      )}

      {error && (
        <div style={{ border: '1px solid #fb923c', background: '#fff7ed', color: '#9a3412', borderRadius: 12, padding: '10px 14px' }}>
          {error}
        </div>
      )}

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <Card style={{ padding: 16 }}>
          <div style={statLabelStyle}>Solicitudes en curso</div>
          <p style={statValueStyle}>{pendingApplications}</p>
          <p style={statHintStyle}>Total de {applicationsTotal} solicitudes registradas.</p>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={statLabelStyle}>Contratos activos</div>
          <p style={statValueStyle}>{activeContracts}</p>
          <p style={statHintStyle}>Tienes {contractsTotal} contratos en tu historial.</p>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={statLabelStyle}>Incidencias abiertas</div>
          <p style={statValueStyle}>{openIncidents}</p>
          <p style={statHintStyle}>Histórico de {incidentsTotal} incidencias en la plataforma.</p>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={statLabelStyle}>Tenant PRO</div>
          <div style={{ margin: '4px 0 6px' }}>
            {proStatus === 'verified' ? (
              <ProBadge maxRent={proInfo?.maxRent} />
            ) : (
              <Badge tone={proStatusInfo[proStatus].tone}>{proStatusInfo[proStatus].label}</Badge>
            )}
          </div>
          <p style={statHintStyle}>{proStatusInfo[proStatus].helper}</p>
        </Card>
      </section>

      <Card style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h3 style={sectionTitleStyle}>Acciones rápidas</h3>
          <span style={{ fontSize: 12, color: '#64748b' }}>Todo lo que usas con frecuencia, a un clic.</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {quickLinks.map(item => (
            <Link key={item.to} to={item.to} style={quickLinkStyle}>
              {item.label}
            </Link>
          ))}
        </div>
      </Card>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <h3 style={sectionTitleStyle}>Solicitudes recientes</h3>
              <p style={sectionHintStyle}>Últimas solicitudes y visitas gestionadas.</p>
            </div>
            <Link to="/tenant/applications" style={sectionLinkStyle}>Ver todas</Link>
          </div>
          {applications.length === 0 ? (
            <p style={{ margin: 0, color: '#64748b' }}>Todavía no has enviado solicitudes. Empieza desde el listado de propiedades.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {applications.slice(0, 3).map(app => {
                const label = app.property?.title ?? `Solicitud ${app.id.slice(-6)}`;
                const subtitle = app.property?.city ? `${app.property.city} · ${formatDate(app.createdAt)}` : `Enviada ${formatDate(app.createdAt)}`;
                return (
                  <div key={app.id} style={tileStyle}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{subtitle}</div>
                    </div>
                    <Badge tone={applicationTone(app.status)}>{applicationStatusLabel[app.status] ?? app.status}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <h3 style={sectionTitleStyle}>Contratos</h3>
              <p style={sectionHintStyle}>Firmas electrónicas, pagos y próximos vencimientos.</p>
            </div>
            <Link to="/contracts" style={sectionLinkStyle}>Ver contratos</Link>
          </div>
          {contracts.length === 0 ? (
            <p style={{ margin: 0, color: '#64748b' }}>Cuando firmes un contrato activo, aparecerá aquí con el estado actualizado.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {contracts.slice(0, 3).map(contract => (
                <div key={contract.id} style={tileStyle}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{contract.property}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Próximo pago {formatDate(contract.nextPaymentAt)} · {contract.rent !== undefined ? euros.format(contract.rent) : '—'}
                    </div>
                  </div>
                  <Badge tone={contractTone(contract.status)}>{contractStatusLabel[contract.status] ?? contract.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <h3 style={sectionTitleStyle}>Incidencias</h3>
              <p style={sectionHintStyle}>Seguimiento de mantenimiento y comunicación con soporte.</p>
            </div>
            <Link to="/tickets" style={sectionLinkStyle}>Abrir tickets</Link>
          </div>
          {incidents.length === 0 ? (
            <p style={{ margin: 0, color: '#64748b' }}>No hay incidencias abiertas. Crea una nueva cuando necesites soporte.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {incidents.slice(0, 3).map(incident => {
                const label = incident.title || `Ticket #${incident.id.slice(-6)}`;
                return (
                  <div key={incident.id} style={tileStyle}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>Creado {formatDate(incident.createdAt)}</div>
                    </div>
                    <Badge tone={incidentTone(incident.status)}>{incidentStatusLabel[incident.status] ?? incident.status}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
          <div>
            <h3 style={sectionTitleStyle}>Recomendado para ti</h3>
            <p style={sectionHintStyle}>Nuevas propiedades que encajan con tu perfil.</p>
          </div>
          {recommended.length === 0 ? (
            <p style={{ margin: 0, color: '#64748b' }}>Consulta el listado completo para descubrir más oportunidades de alquiler.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {recommended.map(property => (
                <div key={property.id} style={tileStyle}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{property.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{property.city ?? 'Ubicación por confirmar'}</div>
                  </div>
                  <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                    {property.price !== undefined && <div style={{ fontWeight: 600 }}>{euros.format(property.price)}</div>}
                    {property.onlyTenantPro && <Badge tone="highlight">Solo PRO</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
