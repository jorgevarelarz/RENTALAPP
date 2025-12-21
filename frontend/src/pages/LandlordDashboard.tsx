import React, { useCallback, useEffect, useState } from 'react';
import { createProperty, listProperties } from '../services/properties';
import axios from 'axios';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Dropzone from '../components/ui/Dropzone';
import PropertyFormRHF from '../components/PropertyFormRHF';
import { Building2, Plus, Home, BarChart3 } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || (process.env as any).VITE_API_URL || 'http://localhost:3000';

const LandlordDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [mine, setMine] = useState<any[]>([]);

  const [isCreating, setIsCreating] = useState(false);
  const [photosText, setPhotosText] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [editing, setEditing] = useState<any | null>(null);

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

  const activeProps = mine.filter(p => p.status === 'active').length;
  const draftProps = mine.filter(p => p.status !== 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Panel de Propietario</h2>
          <p className="text-gray-500">Gestiona tu cartera inmobiliaria.</p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
          <Plus size={18} /> Nueva Propiedad
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 p-3 rounded-lg"><Home className="text-blue-600" /></div>
          <div><p className="text-sm text-gray-500">Total Inmuebles</p><p className="text-2xl font-bold">{mine.length}</p></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-lg"><Building2 className="text-green-600" /></div>
          <div><p className="text-sm text-gray-500">Publicados</p><p className="text-2xl font-bold">{activeProps}</p></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="bg-gray-100 p-3 rounded-lg"><BarChart3 className="text-gray-600" /></div>
          <div><p className="text-sm text-gray-500">Borradores</p><p className="text-2xl font-bold">{draftProps}</p></div>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700">Mis Propiedades</h3>
        </div>

        {mine.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p>Aún no has añadido ninguna propiedad.</p>
            <Button variant="secondary" className="mt-4" onClick={() => setIsCreating(true)}>Empezar ahora</Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {mine.map((p: any) => (
              <div key={p._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    {(p.images?.[0] || p.photos?.[0]) ? (
                      <img src={p.images?.[0] || p.photos?.[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400"><Home size={20} /></div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900">{p.title}</h4>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        p.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {p.status || 'borrador'}
                      </span>
                      {p.onlyTenantPro && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          Solo PRO
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{p.address} · {p.price}€/mes</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
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
                          const code = e?.response?.data?.error;
                          const msg = code === 'min_images_3' ? 'Necesitas al menos 3 imágenes.' : 'Error al publicar';
                          push({ title: msg, tone: 'error' });
                        }
                      }}
                      disabled={((p.images?.length || p.photos?.length || 0) < 3)}
                    >
                      Publicar
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setEditing(p)}>Editar</Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={async () => {
                    if (!token) return;
                    if (!window.confirm('¿Eliminar propiedad?')) return;
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

      <Modal open={isCreating} onClose={() => setIsCreating(false)} title="Nueva Propiedad">
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-sm mb-2">1. Sube fotos primero (Mínimo 3)</h4>
            <Dropzone onFiles={async (files) => {
              if (!token || !files.length) return;
              const form = new FormData(); files.forEach(f => form.append('files', f));
              try {
                setUploading(true);
                const res = await axios.post(`${API_BASE}/api/uploads/images`, form, { headers: { Authorization: `Bearer ${token}` } });
                setPhotoUrls(prev => [...prev, ...res.data.urls]);
              } finally { setUploading(false); }
            }} />
            {uploading && <p className="text-xs text-blue-600 mt-2">Subiendo imágenes...</p>}
            <div className="flex gap-2 flex-wrap mt-3">
              {photoUrls.map((u) => (
                <div key={u} className="relative w-16 h-16">
                  <img src={u} className="w-full h-full object-cover rounded border" alt="preview" />
                  <button onClick={() => setPhotoUrls(l => l.filter(x => x !== u))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">x</button>
                </div>
              ))}
            </div>
          </div>

          <PropertyFormRHF onSubmit={async (data) => {
            if (!token) return;
            const textUrls = photosText.split(',').map(s => s.trim()).filter(Boolean);
            const payload: any = { owner: user?._id, ...data, images: [...photoUrls, ...textUrls] };
            if (payload.onlyTenantPro) payload.requiredTenantProMaxRent = 0;
            await createProperty(token, payload);
            setPhotosText(''); setPhotoUrls([]); setIsCreating(false);
            await refresh();
            push({ title: 'Propiedad creada', tone: 'success' });
          }} uploading={uploading} />
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar Propiedad">
        {editing && (
          <div className="space-y-4">
             <div className="mb-4">
                <label className="text-sm font-semibold">Imágenes actuales</label>
                <div className="flex gap-2 flex-wrap mt-2 mb-4">
                  {(editing.images || editing.photos || []).map((u:string) => (
                    <div key={u} className="relative w-16 h-16 group">
                      <img src={u} className="w-full h-full object-cover rounded border" alt="" />
                      <button
                        type="button"
                        onClick={() => setEditing((ed:any) => ({ ...ed, images: (ed.images || ed.photos).filter((x:string) => x !== u) }))}
                        className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >Borrar</button>
                    </div>
                  ))}
                </div>
                <Dropzone onFiles={async (files) => {
                   const form = new FormData(); files.forEach(f => form.append('files', f));
                   const res = await axios.post(`${API_BASE}/api/uploads/images`, form, { headers: { Authorization: `Bearer ${token}` } });
                   setEditing((ed:any) => ({ ...ed, images: [...(ed.images || ed.photos || []), ...res.data.urls] }));
                }} />
             </div>

             <PropertyFormRHF
              defaultValues={{
                title: editing.title,
                address: editing.address,
                region: editing.region || '',
                city: editing.city || '',
                location: { lat: editing.location?.coordinates?.[1] || 40, lng: editing.location?.coordinates?.[0] || -3 },
                price: editing.price,
                deposit: editing.deposit ?? 0,
                sizeM2: editing.sizeM2 ?? 50,
                rooms: editing.rooms ?? 1,
                bathrooms: editing.bathrooms ?? 1,
                furnished: !!editing.furnished,
                petsAllowed: !!editing.petsAllowed,
                availableFrom: editing.availableFrom ? String(editing.availableFrom).slice(0,10) : '',
                onlyTenantPro: !!editing.onlyTenantPro,
              }}
              onSubmit={async (data) => {
                const payload: any = { ...data, images: editing.images || editing.photos };
                if (payload.onlyTenantPro) payload.requiredTenantProMaxRent = 0;
                await axios.patch(`${API_BASE}/api/properties/${editing._id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
                setEditing(null);
                await refresh();
                push({ title: 'Actualizado', tone: 'success' });
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LandlordDashboard;
