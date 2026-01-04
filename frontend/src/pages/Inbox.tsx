import React, { useEffect, useMemo, useState } from 'react';
import { listConversations, listRelatedUsers, type Conversation, type RelatedUser } from '../services/chat';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProBadge from '../components/ProBadge';
import { useNavigate } from 'react-router-dom';

export default function Inbox() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [related, setRelated] = useState<RelatedUser[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const { user } = useAuth();
  const nav = useNavigate();
  const myId = (user as any)?._id || (user as any)?.id;

  const unreadFor = useMemo(() => (c: Conversation) => {
    if (!myId) return 0;
    return (c.unread && (c.unread as any)[myId]) || 0;
  }, [myId]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setErr('');
        const data = await listConversations({ page: 1, limit: 50, kind: 'direct' });
        setItems(data);
      } catch (e: any) {
        setErr(e?.response?.data?.error || e?.message || 'Error al cargar conversaciones');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!showNew) return;
    (async () => {
      try {
        const data = await listRelatedUsers();
        setRelated(data);
      } catch (e: any) {
        setErr(e?.response?.data?.error || e?.message || 'Error al cargar usuarios');
      }
    })();
  }, [showNew]);

  const targetLink = (c: Conversation) => {
    if (c.kind === 'direct') {
      const other = c.participantsInfo?.find(p => p.id !== String(myId));
      return other?.id ? `/inbox/${other.id}` : '#';
    }
    if (c.kind === 'ticket' && c.meta?.ticketId) return `/tickets/${c.meta.ticketId}`;
    if (c.kind === 'contract' && c.meta?.contractId) return `/contracts/${c.meta.contractId}`;
    if (c.kind === 'appointment' && c.meta?.ticketId) return `/tickets/${c.meta.ticketId}`;
    return '#';
  };

  const systemLabel = (code?: string) => {
    const map: Record<string, string> = {
      TICKET_OPENED: 'Incidencia creada',
      CLOSE_REQUESTED: 'Solicitud de cierre',
      CLOSED_BY_TENANT: 'Incidencia cerrada',
      PAYMENT_SUCCEEDED: 'Pago realizado',
      PAYMENT_FAILED: 'Pago fallido',
      PAYMENT_PROCESSING: 'Pago en proceso',
      APPOINTMENT_CONFIRMED: 'Cita confirmada',
      APPOINTMENT_REJECTED: 'Cita rechazada',
      APPOINTMENT_CANCELLED: 'Cita cancelada',
      APPOINTMENT_RESCHEDULED: 'Cita reprogramada',
      SLOT_PROPOSED: 'Propuesta de cita',
      SERVICE_OFFERED: 'Presupuesto enviado',
      OFFER_ACCEPTED: 'Presupuesto aceptado',
      OFFER_REJECTED: 'Presupuesto rechazado',
      SERVICE_DONE: 'Trabajo finalizado',
    };
    return code ? map[code] || `Evento: ${code}` : 'Evento del sistema';
  };

  const lastPreview = (c: Conversation) => {
    if (!c.lastMessage) return '';
    if (c.lastMessage.type === 'system') return systemLabel(c.lastMessage.systemCode);
    if (c.lastMessage.attachmentUrl) return '📎 Archivo adjunto';
    return c.lastMessage.body || '';
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Conversaciones</h2>
        <p className="text-sm text-gray-500">Listado de chats por persona</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowNew(v => !v)}
          className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Nuevo chat
        </button>
        {showNew && (
          <div className="flex flex-1 items-center gap-2">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full max-w-xs rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Selecciona un usuario</option>
              {related.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || 'Usuario'}{u.role ? ` · ${u.role}` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => selectedUser && nav(`/inbox/${selectedUser}`)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              disabled={!selectedUser}
            >
              Abrir
            </button>
          </div>
        )}
      </div>
      {user?.role === 'tenant' && user?.tenantPro?.status === 'verified' && (
        <div>
          <ProBadge maxRent={user?.tenantPro?.maxRent} />
        </div>
      )}
      {loading && <div className="text-sm text-gray-500">Cargando...</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
      {!loading && items.length === 0 && <div className="text-sm text-gray-500">No hay conversaciones</div>}
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {items.map((c) => {
          const others = c.participantsInfo?.filter(p => p.id !== String(myId)) || [];
          const main = others[0];
          const extraCount = Math.max(0, others.length - 1);
          const displayName = main?.name || 'Usuario';
          const label = extraCount > 0 ? `${displayName} +${extraCount}` : displayName;
          const initials = displayName.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
          return (
            <Link
              key={c._id}
              to={targetLink(c)}
              className="flex items-center gap-4 px-4 py-3 transition hover:bg-gray-50"
            >
              {main?.avatar ? (
                <img
                  src={main.avatar}
                  alt={displayName}
                  className="h-11 w-11 rounded-full border border-gray-200 object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                  {initials || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900">{label}</span>
                  {main?.isPro && <ProBadge maxRent={main?.proLimit} />}
                </div>
                <div className="truncate text-xs text-gray-500">{lastPreview(c)}</div>
              </div>
              <div className="flex flex-col items-end gap-1 text-xs text-gray-400">
                <span>{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString() : ''}</span>
                {unreadFor(c) > 0 && (
                  <span className="rounded-full bg-green-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {unreadFor(c)}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
