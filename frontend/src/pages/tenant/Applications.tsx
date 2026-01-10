import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProBadge from '../../components/ProBadge';
import { api as axios } from '../../api/client';
import { ContractStatusBadge } from '../../components/ContractStatusBadge';
import { acceptApplicationVisit, proposeApplicationVisit } from '../../services/appointments';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import { toAbsoluteUrl } from '../../utils/media';

export default function TenantApplications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposeFor, setProposeFor] = useState<string | null>(null);
  const [proposedDate, setProposedDate] = useState('');
  const [visitDetail, setVisitDetail] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get('/api/applications/my');
        setItems(data.items || []);
      } catch (e: any) {
        setError(e?.response?.data?.error || e?.message || 'Error cargando solicitudes');
      } finally {
        setLoading(false);
      }
    };
    if (user?.role === 'tenant') load();
  }, [user]);

  const isTenantPro = user?.role === 'tenant' && user?.tenantPro?.status === 'verified';
  const formatDateTime = (value?: string) => {
    if (!value) return 'Pendiente';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Pendiente';
    return date.toLocaleString();
  };

  const contractLabel = (status?: string) => {
    if (status === 'pending_signature') return 'Firmar contrato';
    if (status) return 'Ver contrato';
    return 'Contrato no disponible';
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <PageHeader
        title="Solicitudes"
        subtitle="Seguimiento de visitas y propuestas de propietarios."
        cta={(
          <Link to="/properties" className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Buscar pisos
          </Link>
        )}
      />
      {isTenantPro && (
        <div style={{ marginBottom: 8 }}>
          <ProBadge maxRent={user?.tenantPro?.maxRent} />
        </div>
      )}
      {loading && <p>Cargando solicitudes...</p>}
      {error && <p style={{ color: '#b91c1c' }}>Error: {error}</p>}
      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="No tienes solicitudes aun"
          detail="Empieza explorando pisos y agenda tu primera visita."
          cta={(
            <Link to="/properties" className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Buscar pisos
            </Link>
          )}
        />
      )}
      {!loading && !error && items.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((app) => (
            <div key={app._id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{app.property?.title || 'Propiedad'}</div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {app.property?.city || ''} {app.property?.address || ''}
                  </div>
                  {app.proposedDate && (
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      Propuesta: {new Date(app.proposedDate).toLocaleString()}
                    </div>
                  )}
                  {app.visitDate && (
                    <div style={{ fontSize: 12, marginTop: 6 }}>
                      Visita: {formatDateTime(app.visitDate)}
                    </div>
                  )}
                </div>
                <ContractStatusBadge status={app.status || 'pending'} />
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {app.status === 'proposed' && app.proposedBy === 'landlord' && (
                  <>
                    <button
                      onClick={async () => {
                        await acceptApplicationVisit(app._id);
                        const { data } = await axios.get('/api/applications/my');
                        setItems(data.items || []);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs"
                    >
                      Aceptar visita
                    </button>
                    <button
                      onClick={() => {
                        setProposeFor(app._id);
                        setProposedDate('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs"
                    >
                      Proponer nueva hora
                    </button>
                  </>
                )}
                {proposeFor === app._id && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="datetime-local"
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                      className="border rounded px-2 py-1 text-xs"
                    />
                    <button
                      onClick={async () => {
                        if (!proposedDate) return;
                        await proposeApplicationVisit(app._id, proposedDate);
                        setProposeFor(null);
                        const { data } = await axios.get('/api/applications/my');
                        setItems(data.items || []);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs"
                    >
                      Enviar propuesta
                    </button>
                  </div>
                )}
                {app.status === 'proposed' && app.proposedBy === 'tenant' && (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Propuesta enviada. Esperando respuesta del propietario.
                  </span>
                )}
                {app.status === 'scheduled' && app.visitDate && (
                  <button
                    onClick={() => setVisitDetail(app)}
                    className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs"
                  >
                    Ver visita
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!visitDetail}
        onClose={() => setVisitDetail(null)}
        title="Detalle de la visita"
        className="max-w-2xl w-full"
      >
        {visitDetail && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              <div className="font-semibold text-gray-900">{visitDetail.property?.title || 'Propiedad'}</div>
              <div>
                {visitDetail.property?.address || 'Direccion'} {visitDetail.property?.city || ''}
              </div>
              <div className="mt-2">
                <span className="font-medium">Fecha y hora:</span> {formatDateTime(visitDetail.visitDate)}
              </div>
            </div>

            {visitDetail.property?.images?.[0] && (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <img
                  src={toAbsoluteUrl(visitDetail.property.images[0])}
                  alt={visitDetail.property?.title || 'Propiedad'}
                  className="w-full h-48 object-cover"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {visitDetail.property?._id && (
                <Link to={`/properties/${visitDetail.property._id}`}>
                  <Button variant="secondary">Ver propiedad</Button>
                </Link>
              )}
              {visitDetail.property?.owner?._id && (
                <Link to={`/inbox/${visitDetail.property.owner._id}`}>
                  <Button>Iniciar conversacion</Button>
                </Link>
              )}
              {visitDetail.contractId ? (
                <Link to={`/contracts/${visitDetail.contractId}`}>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    {contractLabel(visitDetail.contractStatus)}
                  </Button>
                </Link>
              ) : (
                <Button disabled>{contractLabel()}</Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
