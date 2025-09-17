import React, { useCallback, useEffect, useState } from 'react';
import { createProperty, listProperties } from '../services/properties';
import axios from 'axios';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Dropzone from '../components/ui/Dropzone';
const API_BASE = process.env.REACT_APP_API_URL || (process.env as any).VITE_API_URL || 'http://localhost:3000';

const LandlordDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');
  const [mine, setMine] = useState<any[]>([]);
  const [photos, setPhotos] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<{title?:string; address?:string; price?:string; photos?:string}>({});
  const [editing, setEditing] = useState<any | null>(null);
  const { push } = useToast();

  const refresh = useCallback(async () => {
    const all = await listProperties();
    const ownerId = user?._id;
    setMine(all.filter((p: any) => String(p.ownerId) === ownerId));
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const errs: any = {};
    if (!title.trim()) errs.title = 'Título obligatorio';
    if (!address.trim()) errs.address = 'Dirección obligatoria';
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) errs.price = 'Renta inválida';
    const textUrls = photos.split(',').map(s => s.trim()).filter(Boolean);
    const photoArr = [...photoUrls, ...textUrls];
    const badUrl = photoArr.find(u => !/^https?:\/\//i.test(u));
    if (badUrl) errs.photos = 'Cada URL debe empezar por http(s)://';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    await createProperty(token, { title, address, price: priceNum, photos: photoArr });
    setTitle(''); setAddress(''); setPrice(''); setPhotos('');
    await refresh();
    push({ title: 'Propiedad creada', tone: 'success' });
  };

  return (
    <div>
      <h2>Panel de propietario</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Card style={{ padding: 16 }}>
          <h3>Crear propiedad</h3>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 420, marginTop: 8 }}>
            <div>
              <Input label="Título" placeholder="Piso céntrico" value={title} onChange={e => setTitle(e.target.value)} />
              {errors.title && <div style={{ color: 'red', fontSize: 12 }}>{errors.title}</div>}
            </div>
            <div>
              <Input label="Dirección" placeholder="Calle…" value={address} onChange={e => setAddress(e.target.value)} />
              {errors.address && <div style={{ color: 'red', fontSize: 12 }}>{errors.address}</div>}
            </div>
            <div>
              <Input label="Renta (EUR)" type="number" value={price} onChange={e => setPrice(e.target.value)} />
              {errors.price && <div style={{ color: 'red', fontSize: 12 }}>{errors.price}</div>}
            </div>
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
              {errors.photos && <div style={{ color: 'red', fontSize: 12 }}>{errors.photos}</div>}
              {uploading && <div style={{ fontSize: 12 }}>Subiendo...</div>}
              {photoUrls.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {photoUrls.map((u, idx) => (
                    <div key={u} style={{ position: 'relative' }}>
                      <img alt="foto" src={u} style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                      <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 4 }}>
                        <button type="button" onClick={() => setPhotoUrls(list => list.filter(x => x !== u))} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>x</button>
                        {idx > 0 && <button type="button" onClick={() => setPhotoUrls(list => { const c=[...list]; const t=c[idx-1]; c[idx-1]=c[idx]; c[idx]=t; return c; })} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>↑</button>}
                        {idx < photoUrls.length-1 && <button type="button" onClick={() => setPhotoUrls(list => { const c=[...list]; const t=c[idx+1]; c[idx+1]=c[idx]; c[idx]=t; return c; })} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>↓</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Input label="Fotos (URLs separadas por coma)" placeholder="https://..." value={photos} onChange={e => setPhotos(e.target.value)} />
              {errors.photos && <div style={{ color: 'red', fontSize: 12 }}>{errors.photos}</div>}
            </div>
            <div>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </Card>
        <Card style={{ padding: 16 }}>
          <h3>Mis propiedades</h3>
          {mine.length === 0 ? <p>No tienes propiedades creadas.</p> : (
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {mine.map((p: any) => (
                <div key={p._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)', padding: 10, borderRadius: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.title}</div>
                    <div style={{ fontSize: 12, opacity: .8 }}>{p.address}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
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
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!token) return;
            await axios.patch(`${API_BASE}/api/properties/${editing._id}`, {
              title: editing.title,
              address: editing.address,
              price: editing.price,
            }, { headers: { Authorization: `Bearer ${token}` } });
            setEditing(null);
            await refresh();
            push({ title: 'Propiedad actualizada', tone: 'success' });
          }} style={{ display: 'grid', gap: 12 }}>
            <Input label="Título" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
            <Input label="Dirección" value={editing.address} onChange={e => setEditing({ ...editing, address: e.target.value })} />
            <Input label="Renta (EUR)" type="number" value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} />
            <div>
              <Dropzone onFiles={async (files) => {
                if (!token || !files.length) return;
                const form = new FormData(); files.forEach(f => form.append('files', f));
                const res = await axios.post(`${API_BASE}/api/uploads/images`, form, { headers: { Authorization: `Bearer ${token}` } });
                const urls = (res.data?.urls as string[]) || [];
                setEditing((ed:any) => ({ ...ed, photos: [...(ed.photos || []), ...urls] }));
              }} />
              {Array.isArray(editing.photos) && editing.photos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  {editing.photos.map((u:string, idx:number) => (
                    <div key={u} style={{ position: 'relative' }}>
                      <img alt="foto" src={u} style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)' }} />
                      <div style={{ position: 'absolute', top: 2, right: 2, display: 'flex', gap: 4 }}>
                        <button type="button" onClick={() => setEditing((ed:any) => ({ ...ed, photos: ed.photos.filter((x:string) => x !== u) }))} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>x</button>
                        {idx > 0 && <button type="button" onClick={() => setEditing((ed:any) => { const c=[...ed.photos]; const t=c[idx-1]; c[idx-1]=c[idx]; c[idx]=t; return { ...ed, photos: c }; })} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>↑</button>}
                        {idx < editing.photos.length-1 && <button type="button" onClick={() => setEditing((ed:any) => { const c=[...ed.photos]; const t=c[idx+1]; c[idx+1]=c[idx]; c[idx]=t; return { ...ed, photos: c }; })} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>↓</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default LandlordDashboard;
