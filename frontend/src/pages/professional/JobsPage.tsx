import React, { useEffect, useMemo, useState } from 'react';
import { listMyTickets, sendQuote, requestExtra, completeWork, getTicket } from '../../api/tickets';
import { proposeAppointment } from '../../api/appointments';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/ui/Modal';

interface TicketItem {
  _id: string;
  id?: string;
  service?: string;
  title?: string;
  status?: string;
  quote?: { amount?: number; currency?: string; ts?: string };
  extra?: { amount?: number; reason?: string; status?: string };
  createdAt?: string;
  updatedAt?: string;
}

type QuoteModalState = { open: boolean; ticketId: string | null; amount: string; note: string };
type ExtraModalState = { open: boolean; ticketId: string | null; amount: string; reason: string };
type CompleteModalState = { open: boolean; ticketId: string | null; invoiceUrl: string };
type HistoryModalState = { open: boolean; ticketId: string | null; loading: boolean; events: Array<{ ts?: string; actor?: string; action: string; payload?: any }>; error: string | null };
type AppointmentModalState = { open: boolean; ticketId: string | null; when: string };

const ProfessionalJobsPage: React.FC = () => {
  const { push } = useToast();
  const [items, setItems] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [quoteModal, setQuoteModal] = useState<QuoteModalState>({ open: false, ticketId: null, amount: '', note: '' });
  const [extraModal, setExtraModal] = useState<ExtraModalState>({ open: false, ticketId: null, amount: '', reason: '' });
  const [completeModal, setCompleteModal] = useState<CompleteModalState>({ open: false, ticketId: null, invoiceUrl: '' });
  const [historyModal, setHistoryModal] = useState<HistoryModalState>({ open: false, ticketId: null, loading: false, events: [], error: null });
  const [appointmentModal, setAppointmentModal] = useState<AppointmentModalState>({ open: false, ticketId: null, when: '' });

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listMyTickets('pro', { limit: 100 });
      const mapped = (response?.items ?? []).map((item: any) => ({
        _id: String(item._id || item.id),
        id: String(item._id || item.id),
        service: item.service,
        title: item.title || item.description || item.property || 'Incidencia',
        status: item.status,
        quote: item.quote,
        extra: item.extra,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));
      setItems(mapped);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'No se pudieron cargar tus trabajos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openQuoteModal = (ticketId: string, presetAmount?: number) => {
    setQuoteModal({ open: true, ticketId, amount: presetAmount ? String(presetAmount) : '', note: '' });
  };

  const openExtraModal = (ticketId: string) => {
    setExtraModal({ open: true, ticketId, amount: '', reason: '' });
  };

  const openCompleteModal = (ticketId: string) => {
    setCompleteModal({ open: true, ticketId, invoiceUrl: '' });
  };

  const openHistoryModal = async (ticketId: string) => {
    setHistoryModal({ open: true, ticketId, loading: true, events: [], error: null });
    try {
      const detail = await getTicket(ticketId);
      const events = Array.isArray(detail?.history) ? detail.history : [];
      setHistoryModal({ open: true, ticketId, loading: false, events, error: null });
    } catch (err: any) {
      setHistoryModal({ open: true, ticketId, loading: false, events: [], error: err?.response?.data?.error || err?.message || 'No se pudo cargar el historial.' });
    }
  };

  const openAppointmentModal = (ticketId: string) => {
    const now = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setAppointmentModal({ open: true, ticketId, when: local });
  };

  const activeJobs = useMemo(() => items.filter(item => (item.status || '').toUpperCase() !== 'CLOSED'), [items]);

  const statusLabel = (status?: string) => {
    const value = (status || '').toUpperCase();
    const dict: Record<string, string> = {
      OPEN: 'Abierta',
      QUOTED: 'Presupuesto enviado',
      AWAITING_SCHEDULE: 'Pendiente de agendar',
      IN_PROGRESS: 'En curso',
      AWAITING_VALIDATION: 'Esperando validación',
      ESCROW: 'En escrow',
      CLOSED: 'Cerrada',
      DISPUTE: 'En disputa',
    };
    return dict[value] || status || '—';
  };

  const isBusy = (id: string) => busyId === id;

  const handleSendQuote = async () => {
    if (!quoteModal.ticketId) return;
    const amount = Number(quoteModal.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      push({ title: 'Introduce un importe válido', tone: 'error' });
      return;
    }
    try {
      setBusyId(quoteModal.ticketId);
      await sendQuote(quoteModal.ticketId, amount, quoteModal.note || undefined);
      push({ title: 'Presupuesto enviado', tone: 'success' });
      setQuoteModal({ open: false, ticketId: null, amount: '', note: '' });
      await load();
    } catch (err: any) {
      push({ title: err?.response?.data?.error || err?.message || 'No se pudo enviar el presupuesto', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleRequestExtra = async () => {
    if (!extraModal.ticketId) return;
    const amount = Number(extraModal.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      push({ title: 'Introduce un importe válido', tone: 'error' });
      return;
    }
    try {
      setBusyId(extraModal.ticketId);
      await requestExtra(extraModal.ticketId, amount, extraModal.reason || '');
      push({ title: 'Extra solicitado', tone: 'success' });
      setExtraModal({ open: false, ticketId: null, amount: '', reason: '' });
      await load();
    } catch (err: any) {
      push({ title: err?.response?.data?.error || err?.message || 'No se pudo solicitar el extra', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async () => {
    if (!completeModal.ticketId) return;
    try {
      setBusyId(completeModal.ticketId);
      await completeWork(completeModal.ticketId, completeModal.invoiceUrl || undefined);
      push({ title: 'Trabajo marcado como completado', tone: 'success' });
      setCompleteModal({ open: false, ticketId: null, invoiceUrl: '' });
      await load();
    } catch (err: any) {
      push({ title: err?.response?.data?.error || err?.message || 'No se pudo completar el trabajo', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Trabajos asignados</h1>
        <p style={{ margin: 0, color: '#475569' }}>Gestiona presupuestos, extras y marca la reparación como completada.</p>
      </header>

      {loading && <div style={infoBoxStyle}>Cargando trabajos…</div>}
      {error && <div style={{ ...infoBoxStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      {items.length === 0 && !loading ? (
        <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
          <p style={{ margin: 0 }}>De momento no tienes incidencias asignadas.</p>
        </div>
      ) : (
        <section style={{ display: 'grid', gap: 12 }}>
          {activeJobs.map(item => {
            const status = (item.status || '').toUpperCase();
            const quoteAmount = item.quote?.amount;
            const extraPending = item.extra && item.extra.status === 'pending';
            return (
              <article key={item._id} style={cardStyle}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{item.title}</h2>
                  <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>Servicio: {item.service || 'General'} · Estado: {statusLabel(item.status)}</p>
                  {quoteAmount && <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 12 }}>Presupuesto: {quoteAmount.toLocaleString('es-ES')} €</p>}
                  {extraPending && <p style={{ margin: '6px 0 0', color: '#b91c1c', fontSize: 12 }}>Extra pendiente de aprobación ({item.extra?.amount} €)</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => openQuoteModal(item._id, quoteAmount)} disabled={isBusy(item._id) || !!quoteAmount} style={btnPrimary}>
                      {quoteAmount ? 'Presupuesto enviado' : 'Enviar presupuesto'}
                    </button>
                    <button type="button" onClick={() => openExtraModal(item._id)} disabled={isBusy(item._id)} style={btnGhost}>
                      Solicitar extra
                    </button>
                    <button type="button" onClick={() => openCompleteModal(item._id)} disabled={isBusy(item._id) || status === 'CLOSED'} style={btnSecondary}>
                      Marcar como completado
                    </button>
                    <button type="button" onClick={() => openHistoryModal(item._id)} style={btnGhost}>Ver historial</button>
                    <button type="button" onClick={() => openAppointmentModal(item._id)} style={btnGhost}>Agendar visita</button>
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Última actualización {item.updatedAt ? new Date(item.updatedAt).toLocaleString('es-ES') : '—'}</span>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <Modal open={quoteModal.open} onClose={() => setQuoteModal({ open: false, ticketId: null, amount: '', note: '' })} title="Enviar presupuesto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuote();
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Importe (€)</span>
            <input type="number" min="0" step="0.01" value={quoteModal.amount} onChange={e => setQuoteModal(prev => ({ ...prev, amount: e.target.value }))} required />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Nota (opcional)</span>
            <textarea rows={3} value={quoteModal.note} onChange={e => setQuoteModal(prev => ({ ...prev, note: e.target.value }))} />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setQuoteModal({ open: false, ticketId: null, amount: '', note: '' })} style={btnGhost}>Cancelar</button>
            <button type="submit" style={btnPrimary}>Enviar presupuesto</button>
          </div>
        </form>
      </Modal>

      <Modal open={extraModal.open} onClose={() => setExtraModal({ open: false, ticketId: null, amount: '', reason: '' })} title="Solicitar importe adicional">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRequestExtra();
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Importe (€)</span>
            <input type="number" min="0" step="0.01" value={extraModal.amount} onChange={e => setExtraModal(prev => ({ ...prev, amount: e.target.value }))} required />
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Motivo</span>
            <textarea rows={3} value={extraModal.reason} onChange={e => setExtraModal(prev => ({ ...prev, reason: e.target.value }))} required />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setExtraModal({ open: false, ticketId: null, amount: '', reason: '' })} style={btnGhost}>Cancelar</button>
            <button type="submit" style={btnPrimary}>Solicitar</button>
          </div>
        </form>
      </Modal>

      <Modal open={completeModal.open} onClose={() => setCompleteModal({ open: false, ticketId: null, invoiceUrl: '' })} title="Marcar como completado">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleComplete();
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            <span>URL de factura (opcional)</span>
            <input type="url" value={completeModal.invoiceUrl} onChange={e => setCompleteModal(prev => ({ ...prev, invoiceUrl: e.target.value }))} placeholder="https://..." />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setCompleteModal({ open: false, ticketId: null, invoiceUrl: '' })} style={btnGhost}>Cancelar</button>
            <button type="submit" style={btnSecondary}>Confirmar</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={historyModal.open}
        onClose={() => setHistoryModal({ open: false, ticketId: null, loading: false, events: [], error: null })}
        title="Historial de acciones"
      >
        {historyModal.loading ? (
          <p>Cargando historial…</p>
        ) : historyModal.error ? (
          <p style={{ color: '#b91c1c' }}>{historyModal.error}</p>
        ) : historyModal.events.length === 0 ? (
          <p>No hay eventos registrados.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8 }}>
            {historyModal.events
              .slice()
              .sort((a, b) => (b.ts ? new Date(b.ts).getTime() : 0) - (a.ts ? new Date(a.ts).getTime() : 0))
              .map((event, idx) => (
                <li key={idx} style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{event.action}</div>
                  {event.payload && (
                    <pre style={{ margin: '4px 0 0', background: '#f8fafc', borderRadius: 6, padding: 8, overflowX: 'auto' }}>
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  )}
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>
                    {event.ts ? new Date(event.ts).toLocaleString('es-ES') : ''}
                  </div>
                </li>
              ))}
          </ol>
        )}
      </Modal>

      <Modal
        open={appointmentModal.open}
        onClose={() => setAppointmentModal({ open: false, ticketId: null, when: '' })}
        title="Proponer visita"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!appointmentModal.ticketId) return;
            try {
              setBusyId(appointmentModal.ticketId);
              await proposeAppointment(appointmentModal.ticketId, appointmentModal.when);
              push({ title: 'Cita propuesta al inquilino', tone: 'success' });
              setAppointmentModal({ open: false, ticketId: null, when: '' });
            } catch (err: any) {
              push({ title: err?.response?.data?.error || err?.message || 'No se pudo agendar la visita', tone: 'error' });
            } finally {
              setBusyId(null);
            }
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <label style={{ display: 'grid', gap: 6 }}>
            <span>Fecha y hora</span>
            <input
              type="datetime-local"
              value={appointmentModal.when}
              onChange={e => setAppointmentModal(prev => ({ ...prev, when: e.target.value }))}
              required
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setAppointmentModal({ open: false, ticketId: null, when: '' })} style={btnGhost}>Cancelar</button>
            <button type="submit" style={btnPrimary}>Enviar propuesta</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

const infoBoxStyle: React.CSSProperties = {
  border: '1px solid #cbd5f5',
  background: '#eef2ff',
  color: '#3730a3',
  borderRadius: 12,
  padding: '10px 14px',
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
};

const btnPrimary: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  background: '#16a34a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  background: '#fff',
  color: '#111827',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  padding: '6px 10px',
  cursor: 'pointer',
};

export default ProfessionalJobsPage;
