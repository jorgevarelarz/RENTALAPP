import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyPro, upsertPro } from '../services/pro';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import { Link } from 'react-router-dom';
import { Briefcase, Wallet, Settings, CheckCircle2 } from 'lucide-react';

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
      } catch {}
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
    push({ title: 'Perfil actualizado', tone: 'success' });
  };

  if (!token || !user) return <div>Cargando...</div>;

  const isProfileComplete = displayName && services.length > 0;

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Portal Profesional</h1>
            <p className="text-gray-600">
              {isProfileComplete
                ? 'Tu perfil está activo y visible para clientes.'
                : 'Completa tu perfil para empezar a recibir ofertas.'}
            </p>
          </div>
          {isProfileComplete && (
            <div className="bg-white/50 px-4 py-2 rounded-lg flex items-center gap-2 text-green-700 font-medium">
              <CheckCircle2 size={20} /> Disponible
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/pro/tickets" className="block group">
          <Card className="hover:border-orange-400 transition-colors cursor-pointer h-full flex flex-col items-center text-center p-6">
            <div className="bg-orange-100 p-4 rounded-full mb-4 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
              <Briefcase size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Bolsa de Trabajos</h3>
            <p className="text-gray-500">Busca incidencias y envía presupuestos a propietarios.</p>
          </Card>
        </Link>

        <Link to="/pro/billing" className="block group">
          <Card className="hover:border-blue-400 transition-colors cursor-pointer h-full flex flex-col items-center text-center p-6">
            <div className="bg-blue-100 p-4 rounded-full mb-4 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Wallet size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Facturación</h3>
            <p className="text-gray-500">Gestiona tus ingresos y facturas de servicios realizados.</p>
          </Card>
        </Link>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="text-gray-400" />
          <h3 className="text-lg font-bold text-gray-800">Configuración de Perfil</h3>
        </div>

        <Card style={{ padding: 24 }}>
          <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-700 border-b pb-2">Datos Públicos</h4>
              <Input label="Nombre Comercial / Empresa" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Ej. Reformas García" />
              <Input label="Ciudad de operación" value={city} onChange={e => setCity(e.target.value)} placeholder="Ej. Madrid" />
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-700 border-b pb-2">Servicios Ofrecidos</h4>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {ALL_SERVICES.map(s => {
                  const active = !!services.find(x => x.key === s.key);
                  const price = services.find(x => x.key === s.key)?.basePrice;
                  return (
                    <div key={s.key} className={`flex items-center justify-between p-2 rounded border ${active ? 'bg-orange-50 border-orange-200' : 'border-transparent hover:bg-gray-50'}`}>
                      <label className="flex items-center gap-3 cursor-pointer select-none flex-1">
                        <input type="checkbox" className="w-4 h-4 text-orange-600 rounded" checked={active} onChange={() => toggleService(s.key)} />
                        <span className={active ? 'font-medium text-gray-900' : 'text-gray-600'}>{s.label}</span>
                      </label>
                      {active && (
                        <div className="w-24">
                          <Input
                            placeholder="€ Base"
                            type="number"
                            value={price ?? '' as any}
                            onChange={e => setPrice(s.key, e.target.value)}
                            style={{ padding: '4px 8px', fontSize: 13 }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end pt-4 border-t">
              <Button type="submit" disabled={loading}>
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ProDashboard;
