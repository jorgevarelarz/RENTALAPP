import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyPro, upsertPro } from '../api/pro';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useToast } from '../context/ToastContext';

const ALL_SERVICES = [
  { key: 'plumbing', label: 'Fontanería' },
  { key: 'electricity', label: 'Electricidad' },
  { key: 'appliances', label: 'Electrodomésticos' },
  { key: 'locksmith', label: 'Cerrajería' },
  { key: 'cleaning', label: 'Limpieza' },
  { key: 'painting', label: 'Pintura' },
  { key: 'others', label: 'Otros' },
];

const ProDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const { push } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [services, setServices] = useState<{ key: string; basePrice?: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token || !user) return;
      try {
        setLoading(true);
        const me = await getMyPro(token, user._id);
        setDisplayName(me.displayName || '');
        setCity(me.city || '');
        setServices(me.services || []);
      } catch {/* no pro yet */}
      finally { setLoading(false); }
    })();
  }, [token, user]);

  const toggleService = (key: string) => {
    setServices(prev => prev.find(s => s.key === key) ? prev.filter(s => s.key !== key) : [...prev, { key }]);
  };

  const setPrice = (key: string, price: string) => {
    const v = Number(price);
    setServices(prev => prev.map(s => s.key === key ? { ...s, basePrice: Number.isFinite(v) ? v : undefined } : s));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user) return;
    await upsertPro(token, user._id, { displayName, city, services });
    push({ title: 'Perfil PRO guardado', tone: 'success' });
  };

  if (!token || !user) return <div>Inicia sesión</div>;
  if (loading) return <div>Cargando…</div>;

  return (
    <div>
      <h2>Mi perfil PRO</h2>
      <Card style={{ padding: 16 }}>
        <form onSubmit={save} style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
          <Input label="Nombre comercial" value={displayName} onChange={e => setDisplayName(e.target.value)} />
          <Input label="Ciudad" value={city} onChange={e => setCity(e.target.value)} />
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>Servicios</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {ALL_SERVICES.map(s => {
                const active = !!services.find(x => x.key === s.key);
                const price = services.find(x => x.key === s.key)?.basePrice;
                return (
                  <div key={s.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                      <input type="checkbox" checked={active} onChange={() => toggleService(s.key)} /> {s.label}
                    </label>
                    {active && (
                      <Input placeholder="Precio base (€)" type="number" value={price ?? '' as any} onChange={e => setPrice(s.key, e.target.value)} style={{ width: 160 }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default ProDashboard;
