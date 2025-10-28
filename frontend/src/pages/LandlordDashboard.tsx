import React, { useCallback, useEffect, useState } from 'react';
import { createProperty, listProperties } from '../api/properties';
import axios from 'axios';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Dropzone from '../components/ui/Dropzone';
import PropertyFormRHF from '../components/properties/PropertyFormRHF';

const API_BASE = process.env.REACT_APP_API_URL || (process.env as any).VITE_API_URL || 'http://localhost:3000';

const LandlordDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [mine, setMine] = useState<any[]>([]);
  const [photosText, setPhotosText] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { push } = useToast();

  const refresh = useCallback(async () => {
    const all = await listProperties({ limit: 200, sort: 'createdAt', dir: 'desc' });
    const ownerId = String(user?._id || '');
    const mine = all.filter((p: any) => {
      const owner = p.ownerId || p.owner;
      return owner && String(owner) === ownerId;
    });
    setMine(mine);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div>
      <h2>Panel de propietario</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card style={{ padding: 16 }}>
          <h3>Crear propiedad</h3>
          <div style={{ display: 'grid', gap: 12, maxWidth: 540, marginTop: 8 }}>
            <div>
              <Dropzone onFiles={async (files) => {
                if (!token || files.length === 0) return;
                const form = new FormData();
                files.forEach(f => form.append('files', f));
                try {
                  setUploading(true);
                  const res = await axios.post(`${API_BASE}/api/uploads/images`, form, { headers: { Authorization: `Bearer ${token}` } });
                  const urls = (res.data?.urls as string[]) || [];
                  setPhotoUrls(prev => [...prev, ...urls]);
                  push({ title: `Subidas ${urls.length} imágenes`, tone: 'success' });
                } finally {
                  setUploading(false);
                }
              }} />
              {uploading && <div style={{ fontSize: 12 }}>Subiendo...</div>}
              {photoUrls.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {photoUrls.map((u) => (
                    <div key={u} style={{ position: 'relative' }}>
                      <img alt="foto" src={u} style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                      <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 4 }}>
                        <button type="button" onClick={() => setPhotoUrls(list => list.filter(x => x !== u))} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>x</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Input label="Fotos (URLs separadas por coma)" placeholder="https://..." value={photosText} onChange={e => setPhotosText(e.target.value)} />
            </div>
            <PropertyFormRHF onSubmit={async (data) => {
              if (!token) return;
              const textUrls = photosText.split(',').map(s => s.trim()).filter(Boolean);
              const payload: any = { owner: user?._id, ...data, images: [...photoUrls, ...textUrls] };
              // No permitir editar el mínimo: el backend lo fijará al precio si es Solo PRO
              if (payload.onlyTenantPro) payload.requiredTenantProMaxRent = 0;
              await createProperty(token, payload);
              setPhotosText(''); setPhotoUrls([]);
              await refresh();
              push({ title: 'Propiedad creada', tone: 'success' });
            }} uploading={uploading} />
          </div>
        </Card>
        <Card style={{ padding: 16 }}>
          <h3>Mis propiedades</h3>
          {mine.length === 0 ? <p>No tienes propiedades creadas.</p> : (
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {mine.map((p: any) => (
                <div key={p._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', padding: 10, borderRadius: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 700 }}>{p.title}</div>
                      <span style={{ fontSize: 11, border: '1px solid #E5E7EB', borderRadius: 999, padding: '2px 8px' }}>{p.status || 'draft'}</span>
                      {p.onlyTenantPro && (
                        <span style={{ fontSize: 11, border: '1px solid #111827', borderRadius: 999, padding: '2px 8px' }}>Solo PRO</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, opacity: .8 }}>{p.address}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {p.status !== 'active' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          if (!token) return;
                          try {
                            await axios.post(`${API_BASE}/api/properties/${p._id}/publish`, {}, { headers: { Authorization: `Bearer ${token}` } });
                            await refresh();
                            push({ title: 'Propiedad publicada', tone: 'success' });
                          } catch (e: any) {
                            const code = e?.response?.data?.error;
                            const msg = code === 'min_images_3'
                              ? 'Necesitas al menos 3 imágenes para publicar.'
                              : code === 'owner_not_verified'
                                ? 'Tu cuenta de propietario no está verificada.'
                                : (e?.response?.data?.message || e?.message || 'No se pudo publicar');
                            push({ title: msg, tone: 'error' });
                          }
                        }}
                        disabled={((p.images?.length || p.photos?.length || 0) < 3)}
                      >
                        Publicar
                      </Button>
                    )}
                    {p.status !== 'archived' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          if (!token) return;
                          const ok = window.confirm('¿Archivar propiedad?');
                          if (!ok) return;
                          try {
                            await axios.post(`${API_BASE}/api/properties/${p._id}/archive`, {}, { headers: { Authorization: `Bearer ${token}` } });
                            await refresh();
                            push({ title: 'Propiedad archivada', tone: 'success' });
                          } catch (e: any) {
                            const msg = e?.response?.data?.message || e?.message || 'No se pudo archivar';
                            push({ title: msg, tone: 'error' });
                          }
                        }}
                      >
                        Archivar
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => setEditing(p)}>Editar</Button>
                    <Button variant="danger" size="sm" onClick={async () => {
                      if (!token) return;
                      const ok = window.confirm('¿Eliminar propiedad?');
                      if (!ok) return;
                      await axios.delete(`${API_BASE}/api/properties/${p._id}`, { headers: { Authorization: `Bearer ${token}` } });
                      await refresh();
                      push({ title: 'Propiedad eliminada', tone: 'success' });
                    }}>Eliminar</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar propiedad">
        {editing && (
          <div style={{ display: 'grid', gap: 12 }}>
            <PropertyFormRHF
              defaultValues={{
                title: editing.title,
                address: editing.address,
                region: editing.region || '',
                city: editing.city || '',
                location: {
                  lat: editing.location?.coordinates?.[1] ?? 40.4168,
                  lng: editing.location?.coordinates?.[0] ?? -3.7038,
                },
                price: editing.price,
                deposit: editing.deposit ?? 0,
                sizeM2: editing.sizeM2 ?? 50,
                rooms: editing.rooms ?? 1,
                bathrooms: editing.bathrooms ?? 1,
                furnished: !!editing.furnished,
                petsAllowed: !!editing.petsAllowed,
                availableFrom: editing.availableFrom ? String(editing.availableFrom).slice(0,10) : new Date().toISOString().slice(0,10),
                onlyTenantPro: !!editing.onlyTenantPro,
              }}
              onSubmit={async (data) => {
                if (!token) return;
                const payload: any = {
                  ...data,
                  // En update esperamos location con lat/lng; el backend lo transforma
                };
                if (payload.onlyTenantPro) payload.requiredTenantProMaxRent = 0;
                await axios.patch(`${API_BASE}/api/properties/${editing._id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
                setEditing(null);
                await refresh();
                push({ title: 'Propiedad actualizada', tone: 'success' });
              }}
            />
            <div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Imágenes</div>
              <Dropzone onFiles={async (files) => {
                if (!token || !files.length) return;
                const form = new FormData(); files.forEach(f => form.append('files', f));
                const res = await axios.post(`${API_BASE}/api/uploads/images`, form, { headers: { Authorization: `Bearer ${token}` } });
                const urls = (res.data?.urls as string[]) || [];
                setEditing((ed:any) => ({ ...ed, images: [...(ed.images || ed.photos || []), ...urls] }));
              }} />
              {Array.isArray(editing.images || editing.photos) && (editing.images || editing.photos).length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {(editing.images || editing.photos).map((u:string) => (
                    <div key={u} style={{ position: 'relative' }}>
                      <img alt="foto" src={u} style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                      <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 4 }}>
                        <button type="button" onClick={() => setEditing((ed:any) => ({ ...ed, images: (ed.images || ed.photos).filter((x:string) => x !== u) }))} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>x</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LandlordDashboard;
