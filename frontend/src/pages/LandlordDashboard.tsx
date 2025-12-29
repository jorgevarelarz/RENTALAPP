import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { createProperty, listProperties } from '../services/properties';
import { userService } from '../services/user';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import Spinner from '../components/ui/Spinner';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import PropertyFormRHF, { PropertyFormData } from '../components/PropertyFormRHF';
import ApplicantsModal from '../components/ApplicantsModal';
import { Building2, Plus, Home, BarChart3, Image as ImageIcon, Users } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || (process.env as any).VITE_API_URL || 'http://localhost:3000';

const IconCash = () => (
  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const IconHome = () => (
  <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);
const IconDoc = () => (
  <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" />
  </svg>
);

const LandlordDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [mine, setMine] = useState<any[]>([]);
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
  }, [user]);

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
    const res = await axios.post(`${API_BASE}/api/uploads/images`, form, { headers: { Authorization: `Bearer ${token}` } });
    return res.data.urls || [];
  };

  const handleSubmit = async (data: PropertyFormData) => {
    if (!token) return;
    try {
      const payload: any = { ...data, owner: user?._id };
      if (editingProperty) {
        await axios.patch(`${API_BASE}/api/properties/${editingProperty._id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
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

  const activeProps = mine.filter(p => p.status === 'active').length;
  const draftProps = mine.filter(p => p.status !== 'active').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Panel de propietario</h1>
          <p className="text-gray-500 mt-1">Gestiona inmuebles e ingresos desde aquí.</p>
        </div>
        <Button onClick={openCreate} className="shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
          <Plus size={20} className="mr-2" /> Nueva Propiedad
        </Button>
      </div>

      {statsLoading ? (
        <div className="p-6 flex justify-center"><Spinner /></div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 border-l-4 border-l-green-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase">Ingresos totales</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{stats.earnings} €</h3>
                </div>
                <div className="p-3 bg-green-50 rounded-full">
                  <IconCash />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-l-indigo-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase">Propiedades</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <h3 className="text-3xl font-bold text-gray-900">{stats.properties.total}</h3>
                    <span className="text-sm text-gray-500">({stats.properties.rented} alquiladas)</span>
                  </div>
                </div>
                <div className="p-3 bg-indigo-50 rounded-full">
                  <IconHome />
                </div>
              </div>
            </Card>

            <Card className="p-6 border-l-4 border-l-yellow-500">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase">En tramite</p>
                  <h3 className="text-3xl font-bold text-gray-900 mt-2">{stats.contracts.pending}</h3>
                  <p className="text-xs text-gray-500 mt-1">Contratos pendientes de firma</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-full">
                  <IconDoc />
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-gray-800">Ultimos pagos recibidos</h3>
                <Link to="/landlord/payments" className="text-sm text-indigo-600 hover:text-indigo-800">
                  Ver todos
                </Link>
              </div>

              {stats.recentPayments.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No hay pagos recientes.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {stats.recentPayments.map((payment: any) => (
                    <div key={payment.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="font-semibold text-gray-900">{payment.concept}</p>
                        <p className="text-xs text-gray-500">
                          {payment.propertyName} • {new Date(payment.date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-green-600">+{payment.amount} €</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <h3 className="font-bold text-gray-800 mb-4">Gestion rapida</h3>
              <div className="space-y-3">
                <Link to="/properties" className="block w-full p-3 text-left border rounded hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                  Mis propiedades: editar detalles y precios.
                </Link>
                <Link to="/contracts" className="block w-full p-3 text-left border rounded hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                  Contratos: revisar borradores y firmas.
                </Link>
                <Link to="/incidents" className="block w-full p-3 text-left border rounded hover:border-indigo-500 hover:bg-indigo-50 transition-all">
                  Mantenimiento: incidencias abiertas.
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : (
        <Card className="p-6 text-center text-gray-500">No se pudieron cargar las estadisticas.</Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-lg"><Home className="text-blue-600" size={24}/></div>
          <div><p className="text-sm text-gray-500 font-medium">Total Inmuebles</p><p className="text-2xl font-bold">{mine.length}</p></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-green-50 p-3 rounded-lg"><Building2 className="text-green-600" size={24}/></div>
          <div><p className="text-sm text-gray-500 font-medium">Publicados</p><p className="text-2xl font-bold">{activeProps}</p></div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-gray-50 p-3 rounded-lg"><BarChart3 className="text-gray-600" size={24}/></div>
          <div><p className="text-sm text-gray-500 font-medium">Borradores</p><p className="text-2xl font-bold">{draftProps}</p></div>
        </div>
      </div>

      <Card className="overflow-hidden border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="font-semibold text-gray-800">Mis Propiedades</h3>
        </div>

        {mine.length === 0 ? (
          <div className="p-16 text-center">
            <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Home size={32} />
            </div>
            <h4 className="text-lg font-medium text-gray-900">Aun no tienes propiedades</h4>
            <p className="text-gray-500 mb-6">Crea tu primer anuncio en menos de 2 minutos.</p>
            <Button variant="secondary" onClick={openCreate}>Empezar ahora</Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {mine.map((p: any) => (
              <div key={p._id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 relative">
                    {(p.images?.[0] || p.photos?.[0]) ? (
                      <img src={p.images?.[0] || p.photos?.[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400"><ImageIcon size={24} /></div>
                    )}
                    {p.onlyTenantPro && (
                      <div className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-[10px] font-bold text-center py-0.5">PRO</div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{p.title}</h4>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        p.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                        p.status === 'rented' ? 'bg-gray-100 text-gray-600 border-gray-300' :
                        'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>
                        {p.status === 'active' ? 'Publicado' : p.status === 'rented' ? 'Alquilado' : 'Borrador'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{p.address}, {p.city}</p>
                    <p className="text-sm font-medium text-gray-900 mt-1">{p.price} €/mes</p>
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
                          await axios.post(`${API_BASE}/api/properties/${p._id}/publish`, {}, { headers: { Authorization: `Bearer ${token}` } });
                          await refresh();
                          push({ title: 'Propiedad publicada', tone: 'success' });
                        } catch (e: any) {
                          const msg = e?.response?.data?.error === 'min_images_3'
                            ? 'Sube al menos 3 fotos para publicar.'
                            : 'Error al publicar';
                          push({ title: msg, tone: 'error' });
                        }
                      }}
                      disabled={((p.images?.length || p.photos?.length || 0) < 3)}
                      className={((p.images?.length || 0) < 3) ? "opacity-50 cursor-not-allowed" : ""}
                      title={((p.images?.length || 0) < 3) ? "Faltan fotos" : "Publicar ahora"}
                    >
                      Publicar
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>Editar</Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={async () => {
                    if (!window.confirm('¿Estás seguro de eliminar este borrador?')) return;
                    await axios.delete(`${API_BASE}/api/properties/${p._id}`, { headers: { Authorization: `Bearer ${token}` } });
                    await refresh();
                    push({ title: 'Eliminada', tone: 'success' });
                  }}>Borrar</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProperty ? "Editar Propiedad" : "Nueva Propiedad"}>
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
