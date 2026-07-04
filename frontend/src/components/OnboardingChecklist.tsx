import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import Card from './ui/Card';

type Item = { label: string; to: string; done?: boolean };

const itemsByRole: Record<string, Item[]> = {
  tenant: [
    { label: 'Completar perfil', to: '/profile' },
    { label: 'Validar Tenant PRO', to: '/tenant-pro' },
    { label: 'Buscar vivienda', to: '/properties', done: true },
    { label: 'Revisar solicitudes', to: '/tenant/applications' },
  ],
  landlord: [
    { label: 'Completar perfil', to: '/profile' },
    { label: 'Publicar propiedad', to: '/landlord' },
    { label: 'Revisar candidatos', to: '/landlord/showings' },
    { label: 'Preparar contratos', to: '/contracts' },
  ],
  pro: [
    { label: 'Completar perfil profesional', to: '/pro/profile' },
    { label: 'Definir servicios', to: '/pro' },
    { label: 'Revisar trabajos', to: '/pro/tickets' },
    { label: 'Preparar facturación', to: '/pro/billing' },
  ],
};

export default function OnboardingChecklist({ role }: { role?: string }) {
  const items = itemsByRole[role || ''] || [];
  if (!items.length) return null;

  return (
    <Card className="p-5 border border-gray-200">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Primeros pasos</h2>
          <p className="text-sm text-gray-500">Cierra estos puntos para dejar tu cuenta lista.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <Link key={item.label} to={item.to} className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm hover:bg-white hover:border-gray-300">
            {item.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-gray-400" />}
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
