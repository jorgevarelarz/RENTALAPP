import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listMyTickets } from '../../api/tickets';

const ProfessionalHomePage: React.FC = () => {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState({
    activeJobs: 0,
    quoted: 0,
    awaitingSchedule: 0,
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        setError(null);
        const response = await listMyTickets('pro', { limit: 100 });
        const items: any[] = response?.items || [];
        const activeJobs = items.filter(item => (item.status || '').toUpperCase() !== 'CLOSED').length;
        const quoted = items.filter(item => (item.status || '').toUpperCase() === 'QUOTED').length;
        const awaitingSchedule = items.filter(item => (item.status || '').toUpperCase() === 'AWAITING_SCHEDULE').length;
        setMetrics({ activeJobs, quoted, awaitingSchedule });
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'No se pudieron cargar tus trabajos.');
      }
    };
    load();
  }, [token]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Panel de profesional</h1>
        <p style={{ margin: 0, color: '#475569' }}>Trabajos asignados, SLA y próximos cobros.</p>
      </header>

      {error && (
        <div style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 12, padding: '10px 14px' }}>
          {error}
        </div>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <MetricCard title="Trabajos activos" value={metrics.activeJobs} helper="Incidencias aún abiertas" />
        <MetricCard title="Presupuestos enviados" value={metrics.quoted} helper="Pendientes de aprobación" />
        <MetricCard title="Pendientes de agendar" value={metrics.awaitingSchedule} helper="Esperando cita con el inquilino" />
      </section>
    </div>
  );
};

function MetricCard({ title, value, helper }: { title: string; value: number; helper: string }) {
  return (
    <article style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, background: '#fff' }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>{value}</p>
      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>{helper}</p>
    </article>
  );
}

export default ProfessionalHomePage;
