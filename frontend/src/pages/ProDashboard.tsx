import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getMyProProfile } from '../services/pro';
import { getProSummary } from '../services/tickets';
import Card from '../components/ui/Card';
import { SummaryFigures } from '../components/pro/ProTicketList';
import { formatEuros, getServiceLabel } from '../utils/tickets';

const primaryLink =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90';
const secondaryLink =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const jobs = (n: number) => count(n, 'trabajo', 'trabajos');

/** Perfil público: crearlo es lo primero, porque sin él no se le pueden asignar averías. */
function ProfileCard() {
  const { data: pro, isLoading, isError } = useQuery({ queryKey: ['pro/me'], queryFn: getMyProProfile });
  if (isLoading || isError) return null;

  if (!pro) {
    return (
      <Card className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Crea tu perfil profesional</h2>
          <p className="mt-1 text-sm text-gray-600">
            Los propietarios solo pueden asignarte averías cuando tienes perfil: nombre comercial, ciudad y servicios.
          </p>
        </div>
        <Link to="/pro/profile" className={`${primaryLink} self-start md:self-auto`}>Crear perfil</Link>
      </Card>
    );
  }

  const services = (pro.services || []).map(s => getServiceLabel(s.key)).join(', ');
  return (
    <Card className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{pro.displayName}</p>
        <p className="mt-0.5 text-sm text-gray-500">
          {[pro.city, services || 'Sin servicios'].join(' · ')}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className={`text-sm font-medium ${pro.active ? 'text-emerald-700' : 'text-gray-500'}`}>
          {pro.active ? 'Visible para propietarios' : 'Perfil pausado'}
        </span>
        <Link to="/pro/profile" className="text-sm font-medium text-[var(--primary)] hover:underline">Editar</Link>
      </div>
    </Card>
  );
}

const ProDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: summary, isLoading, isError } = useQuery({ queryKey: ['pro/summary'], queryFn: getProSummary });
  const firstName = (user as any)?.name?.split?.(' ')?.[0] || user?.email?.split?.('@')?.[0] || '';

  const todo = summary
    ? [
        { to: '/pro/quotes', label: 'Por presupuestar', detail: 'Te han asignado la avería y falta tu presupuesto.', count: summary.quotes.toQuote },
        { to: '/pro/tickets?status=awaiting_schedule', label: 'Por agendar', detail: 'Presupuesto aprobado: acuerda la visita.', count: summary.work?.toSchedule || 0 },
        { to: '/pro/tickets?status=scheduled', label: 'En curso', detail: 'Visita agendada o trabajo empezado.', count: summary.work?.inProgress || 0 },
      ].filter(item => item.count > 0)
    : [];
  const waiting = summary
    ? [
        summary.quotes.awaitingApproval > 0 && `aprobar ${count(summary.quotes.awaitingApproval, 'presupuesto', 'presupuestos')}`,
        (summary.work?.awaitingValidation || 0) > 0 && `validar ${count(summary.work.awaitingValidation, 'trabajo terminado', 'trabajos terminados')}`,
      ].filter(Boolean)
    : [];
  const b = summary?.billing;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{firstName ? `Hola, ${firstName}` : 'Tu trabajo'}</h1>
          <p className="mt-1 text-gray-500">Las averías que te han asignado, tus presupuestos y lo que tienes por cobrar.</p>
        </div>
        <Link to="/pro/tickets" className={`${secondaryLink} self-start md:self-auto`}>Ver todos los trabajos</Link>
      </div>

      <ProfileCard />

      <Card className="overflow-hidden">
        <h2 className="border-b border-gray-100 px-5 py-4 font-semibold text-gray-900">Lo que te toca</h2>
        {isLoading ? (
          <p className="px-5 py-6 text-sm text-gray-500">Cargando…</p>
        ) : isError ? (
          <p className="px-5 py-6 text-sm text-red-700">No se pudo cargar tu resumen. Vuelve a intentarlo en un momento.</p>
        ) : todo.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">Nada pendiente por tu parte. Cuando un propietario te asigne una avería, aparecerá aquí.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {todo.map(item => (
              <li key={item.label}>
                <Link to={item.to} className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{item.label}</p>
                    <p className="mt-0.5 text-sm text-gray-500">{item.detail}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xl font-semibold tabular-nums text-gray-900">{item.count}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {waiting.length > 0 && (
          <p className="border-t border-gray-100 px-5 py-3 text-sm text-gray-500">Pendiente del propietario: {waiting.join(' · ')}.</p>
        )}
      </Card>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Cobros</h2>
          <Link to="/pro/billing" className="text-sm font-medium text-[var(--primary)] hover:underline">Ver facturación</Link>
        </div>
        <SummaryFigures
          figures={[
            { label: 'Pendiente de liberar', value: b ? formatEuros(b.pendingTotal) : '—', hint: b ? jobs(b.pendingCount) : undefined },
            { label: 'Pagos liberados', value: b ? formatEuros(b.releasedTotal) : '—', hint: b ? jobs(b.releasedCount) : undefined },
          ]}
        />
      </div>
    </div>
  );
};

export default ProDashboard;
