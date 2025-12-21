import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { createProperty, listProperties } from '../services/properties';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import PropertyFormRHF, { PropertyFormData } from '../components/PropertyFormRHF';
import { Building2, Plus, Home, BarChart3, Image as ImageIcon } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || (process.env as any).VITE_API_URL || 'http://localhost:3000';

const LandlordDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [mine, setMine] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any | null>(null);
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

  useEffect(() => { refresh(); }, [refresh]);

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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mi Cartera</h1>
          <p className="text-gray-500 mt-1">Gestiona tus inmuebles y anuncios desde aquí.</p>
        </div>
        <Button onClick={openCreate} className="shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
          <Plus size={20} className="mr-2" /> Nueva Propiedad
        </Button>
      </div>

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
            <h4 className="text-lg font-medium text-gray-900">Aún no tienes propiedades</h4>
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
    </div>
  );
};

export default LandlordDashboard;
