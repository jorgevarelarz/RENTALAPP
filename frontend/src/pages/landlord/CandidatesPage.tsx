import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listOwnerApplications,
  respondApplication,
  toggleApplicationTenantPro,
  sendApplicationMessage,
} from '../../api/applications';
import { useAuth } from '../../context/AuthContext';
import type { Application } from '@rental-app/types/applications';
import { useToast } from '../../context/ToastContext';
import Badge from '../../components/ui/Badge';
import ApplicationChatPanel from '../../components/applications/ApplicationChatPanel';
import ReasonModal from '../../components/ui/ReasonModal';

const rejectionReasons = ['Ingresos insuficientes', 'Documentación incompleta', 'Preferimos otro candidato'];

export default function LandlordCandidatesPage() {
  const { token } = useAuth();
  const { push } = useToast();
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; applicationId: string | null; reason: string; comment: string }>({ open: false, applicationId: null, reason: '', comment: '' });

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const response = await listOwnerApplications(token, { limit: 100 });
      setItems(response?.items ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'No se pudieron cargar los candidatos.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount = useMemo(() => items.filter(item => item.status === 'pending').length, [items]);

  const handleDecision = async (id: string, decision: 'accept' | 'reject') => {
    if (!token) return;
    if (decision === 'reject') {
      setRejectModal({ open: true, applicationId: id, reason: '', comment: '' });
      return;
    }
    try {
      setBusyId(id);
      await respondApplication(token, id, decision);
      push({ title: 'Solicitud aprobada', tone: 'success' });
      await load();
    } catch (err: any) {
      push({ title: err?.response?.data?.error || err?.message || 'Acción no disponible', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleTogglePro = async (id: string, enable: boolean) => {
    if (!token) return;
    try {
      setBusyId(id);
      await toggleApplicationTenantPro(token, id, enable);
      push({ title: enable ? 'Marcado como PRO' : 'Insignia PRO retirada', tone: 'success' });
      await load();
    } catch (err: any) {
      push({ title: err?.response?.data?.error || err?.message || 'No se pudo actualizar', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleMessage = async (id: string) => {
    if (!token) return;
    const message = window.prompt('Mensaje para el inquilino');
    if (!message || !message.trim()) return;
    try {
      setBusyId(id);
      await sendApplicationMessage(token, id, message.trim());
      push({ title: 'Mensaje enviado', tone: 'success' });
    } catch (err: any) {
      push({ title: err?.response?.data?.error || err?.message || 'No se pudo enviar el mensaje', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  if (!token) {
    return <p>Inicia sesión como propietario para ver tus candidatos.</p>;
  }

  const buildRejectReason = () => {
    const parts: string[] = [];
    if (rejectModal.reason) parts.push(rejectModal.reason);
    if (rejectModal.comment.trim()) parts.push(rejectModal.comment.trim());
    return parts.join(' · ');
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Candidatos</h1>
        <p style={{ margin: 0, color: '#475569' }}>
          Revisa solicitudes por inmueble, su badge PRO y decide el siguiente paso.
        </p>
      </header>

      <section style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Solicitudes recibidas</span>
          <strong style={summaryValueStyle}>{items.length}</strong>
        </div>
        <div style={summaryCardStyle}>
          <span style={summaryLabelStyle}>Pendientes de decisión</span>
          <strong style={summaryValueStyle}>{pendingCount}</strong>
        </div>
      </section>

      {loading && <div style={infoBoxStyle}>Cargando solicitudes…</div>}
      {error && <div style={{ ...infoBoxStyle, borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

      {items.length === 0 && !loading ? (
        <div style={{ border: '1px dashed #cbd5f5', borderRadius: 16, padding: 24 }}>
          <p style={{ margin: 0 }}>Aún no tienes candidatos. Cuando un inquilino aplique a tus inmuebles, aparecerá aquí.</p>
        </div>
      ) : (
        <section style={{ display: 'grid', gap: 12 }}>
          {items.map(item => {
            const tenant = item.tenant;
            const propertyTitle = item.property?.title ?? `Solicitud ${item.id.slice(-6)}`;
            const tenantBadge = tenant?.tenantProStatus === 'verified'
              ? `PRO · ${tenant?.tenantProMaxRent?.toLocaleString('es-ES') ?? 0} €/mes`
              : tenant?.tenantProStatus ?? 'sin validar';
            const isBusy = busyId === item.id;
            return (
              <article key={item.id} style={cardStyle}>
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{propertyTitle}</h2>
                  <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>
                    Inquilino: {tenant?.name || tenant?.email || '—'} · {tenantBadge}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  <span style={{ fontSize: 12, color: '#475569' }}>Enviada {formatDate(item.createdAt)}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => handleDecision(item.id, 'accept')} disabled={isBusy} style={btnPrimary}>
                      Aprobar
                    </button>
                    <button type="button" onClick={() => handleDecision(item.id, 'reject')} disabled={isBusy} style={btnSecondary}>
                      Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTogglePro(item.id, tenant?.tenantProStatus !== 'verified')}
                      disabled={isBusy}
                      style={btnGhost}
                    >
                      {tenant?.tenantProStatus === 'verified' ? 'Quitar PRO' : 'Marcar PRO'}
                    </button>
                    <button type="button" onClick={() => handleMessage(item.id)} disabled={isBusy} style={btnGhost}>
                      Mensaje rápido
                    </button>
                    <button type="button" onClick={() => setChatId(item.id)} style={btnGhost}>
                      Abrir chat
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {chatId && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Chat interno con el candidato</h2>
            <button type="button" onClick={() => setChatId(null)} style={btnGhost}>
              Cerrar chat
            </button>
          </div>
          <ApplicationChatPanel applicationId={chatId} />
        </div>
      )}

      <ReasonModal
        open={rejectModal.open}
        title="Motivo de rechazo"
        reasons={rejectionReasons}
        selected={rejectModal.reason || ''}
        comment={rejectModal.comment}
        onChangeReason={value => setRejectModal(prev => ({ ...prev, reason: value === '__custom__' ? '' : value }))}
        onChangeComment={value => setRejectModal(prev => ({ ...prev, comment: value }))}
        onClose={() => setRejectModal({ open: false, applicationId: null, reason: '', comment: '' })}
        onConfirm={async () => {
          if (!token || !rejectModal.applicationId) return;
          const reasonText = buildRejectReason();
          try {
            setBusyId(rejectModal.applicationId);
            await respondApplication(token, rejectModal.applicationId, 'reject', reasonText || undefined);
            push({ title: 'Solicitud rechazada', tone: 'success' });
            setRejectModal({ open: false, applicationId: null, reason: '', comment: '' });
            await load();
          } catch (err: any) {
            push({ title: err?.response?.data?.error || err?.message || 'No se pudo rechazar la solicitud', tone: 'error' });
          } finally {
            setBusyId(null);
          }
        }}
      />
    </div>
  );
}

const statusTone = (status: string): 'default' | 'new' | 'highlight' => {
  if (status === 'accepted') return 'highlight';
  if (status === 'pending') return 'new';
  return 'default';
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
};

const summaryCardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: 16,
  background: '#fff',
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: '#64748b',
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: 24,
  marginTop: 6,
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

const btnBase: React.CSSProperties = {
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: '#16a34a',
  color: '#fff',
  border: 'none',
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: '#dc2626',
  color: '#fff',
  border: 'none',
};

const btnGhost: React.CSSProperties = {
  ...btnBase,
  background: '#fff',
  border: '1px solid #e2e8f0',
  color: '#111827',
};
