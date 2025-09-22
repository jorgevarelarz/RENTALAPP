import React, { useEffect, useMemo, useState } from 'react';
import { listConversations, type Conversation } from '../services/chat';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Inbox() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const { user } = useAuth();

  const unreadFor = useMemo(() => (c: Conversation) => {
    if (!user?._id) return 0;
    return (c.unread && (c.unread as any)[user._id]) || 0;
  }, [user?._id]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setErr('');
        const data = await listConversations({ page: 1, limit: 50 });
        setItems(data);
      } catch (e: any) {
        setErr(e?.response?.data?.error || e?.message || 'Error al cargar conversaciones');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const targetLink = (c: Conversation) => {
    if (c.kind === 'ticket' && c.meta?.ticketId) return `/tickets/${c.meta.ticketId}`;
    if (c.kind === 'contract' && c.meta?.contractId) return `/contracts/${c.meta.contractId}`;
    if (c.kind === 'appointment' && c.meta?.ticketId) return `/tickets/${c.meta.ticketId}`;
    // fallback: stay
    return '#';
  };

  return (
    <div>
      <h2>Conversaciones</h2>
      {loading && <div>Cargando…</div>}
      {err && <div style={{ color: '#b91c1c' }}>{err}</div>}
      {!loading && items.length === 0 && <div>No hay conversaciones</div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((c) => (
          <Link
            key={c._id}
            to={targetLink(c)}
            style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid var(--border)', borderRadius: 8, padding: 12, textDecoration: 'none', color: 'inherit' }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{c.kind.toUpperCase()}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                {c.kind === 'ticket' && c.meta?.ticketId ? `Ticket ${String(c.meta.ticketId).slice(-6)}` : null}
                {c.kind === 'contract' && c.meta?.contractId ? `Contrato ${String(c.meta.contractId).slice(-6)}` : null}
                {c.kind === 'appointment' && c.meta?.appointmentId ? `Cita ${String(c.meta.appointmentId).slice(-6)}` : null}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12 }}>
              <div>{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleString() : ''}</div>
              {unreadFor(c) > 0 && (
                <div style={{ marginTop: 6, display: 'inline-block', background: '#ef4444', color: '#fff', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>
                  {unreadFor(c)}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
