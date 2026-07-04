import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Building2,
  ClipboardList,
  FileCheck2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import api, { formatApiError } from '../../api/client';

type AdminStats = {
  users?: {
    total?: number;
    tenants?: number;
    landlords?: number;
    admins?: number;
  };
  properties?: number;
  contracts?: {
    total?: number;
    draft?: number;
    active?: number;
    completed?: number;
    cancelled?: number;
  };
};

type AdminRequest = {
  _id: string;
  type?: string;
  status?: string;
  createdAt?: string;
};

const quickLinks = [
  { to: '/admin/tenant-pro', label: 'KYC / Tenant PRO', icon: ShieldCheck, detail: 'Validaciones y documentos' },
  { to: '/admin/users', label: 'Usuarios', icon: Users, detail: 'Roles, altas y actividad' },
  { to: '/admin/properties', label: 'Propiedades', icon: Building2, detail: 'Inventario y publicaciones' },
  { to: '/admin/compliance', label: 'Compliance', icon: FileCheck2, detail: 'Auditoría legal' },
  { to: '/admin/compliance/tensioned-areas', label: 'Zonas tensionadas', icon: ClipboardList, detail: 'Reglas por zona' },
  { to: '/admin/system-events', label: 'System events', icon: Activity, detail: 'Errores y eventos técnicos' },
];

function formatNumber(value: unknown) {
  return typeof value === 'number' ? value.toLocaleString('es-ES') : '0';
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
    </div>
  );
}

export default function AdminHome() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingRequests, setPendingRequests] = useState<AdminRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    Promise.all([
      api.get('/api/admin/stats'),
      api.get('/api/admin/requests', { params: { status: 'pending' } }),
    ])
      .then(([statsResponse, requestsResponse]) => {
        if (!active) return;
        setStats(statsResponse.data || {});
        setPendingRequests(Array.isArray(requestsResponse.data?.items) ? requestsResponse.data.items : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(formatApiError(err, 'No se pudo cargar el panel admin'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Operación RentalApp</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Centro de mando admin</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Métricas, revisiones pendientes y accesos directos para soporte, compliance y operación diaria.
          </p>
        </div>
        <Link
          to="/admin/system-events"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <Activity className="h-4 w-4" />
          Ver eventos
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Usuarios"
          value={loading ? '...' : formatNumber(stats?.users?.total)}
          hint={`${formatNumber(stats?.users?.tenants)} tenants · ${formatNumber(stats?.users?.landlords)} landlords`}
        />
        <StatCard
          label="Propiedades"
          value={loading ? '...' : formatNumber(stats?.properties)}
          hint="Publicadas o en revisión"
        />
        <StatCard
          label="Contratos"
          value={loading ? '...' : formatNumber(stats?.contracts?.total)}
          hint={`${formatNumber(stats?.contracts?.active)} activos`}
        />
        <StatCard
          label="En trámite"
          value={loading ? '...' : formatNumber(stats?.contracts?.draft)}
          hint="Contratos pendientes de cierre"
        />
        <StatCard
          label="Revisiones"
          value={loading ? '...' : formatNumber(pendingRequests.length)}
          hint="Solicitudes admin pendientes"
        />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">Accesos operativos</h2>
          <span className="text-sm text-slate-500">Soporte, compliance y control</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-blue-50 p-2 text-blue-700 group-hover:bg-blue-100">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-semibold text-slate-950">{item.label}</span>
                    <span className="mt-1 block text-sm text-slate-500">{item.detail}</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-950">Pendiente de revisión</h2>
          <Link to="/admin/tenant-pro" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
            Abrir cola
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500">Cargando solicitudes...</p>
        ) : pendingRequests.length === 0 ? (
          <p className="text-sm text-slate-500">No hay solicitudes admin pendientes ahora mismo.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {pendingRequests.slice(0, 5).map((request) => (
              <div key={request._id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{request.type || 'Solicitud'}</p>
                  <p className="text-xs text-slate-500">{request.createdAt ? new Date(request.createdAt).toLocaleString('es-ES') : 'Sin fecha'}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  {request.status || 'pending'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
