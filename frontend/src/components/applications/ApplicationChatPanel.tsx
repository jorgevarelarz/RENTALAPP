import React, { useEffect, useRef, useState } from 'react';
import { ensureConversation, getMessages, sendMessage } from '../../api/chat';
import { useAuth } from '../../context/AuthContext';

export default function ApplicationChatPanel({ applicationId }: { applicationId: string }) {
  const [conversationId, setConversationId] = useState<string>('');
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      if (!applicationId) return;
      const conv = await ensureConversation('application', applicationId);
      setConversationId(conv._id);
      const msgs = await getMessages(conv._id, { limit: 50 });
      setMessages(msgs.slice().reverse());
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 0);
    })();
  }, [applicationId]);

  const onSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!conversationId || !body.trim()) return;
    const msg = await sendMessage(conversationId, body.trim());
    setMessages(prev => [...prev, msg]);
    setBody('');
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 0);
  };

  if (!user) return null;

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, display: 'grid', gap: 12 }}>
      <header>
        <h2 style={{ margin: '0 0 4px' }}>Mensajes con el inquilino</h2>
        <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
          La comunicación permanece en la plataforma; no se envían correos externos.
        </p>
      </header>
      <div
        ref={listRef}
        style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 6, padding: 8, background: '#f8fafc', borderRadius: 6 }}
      >
        {messages.map(msg => (
          <div key={msg._id} style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 600 }}>{msg.senderId === user._id ? 'Tú' : 'Candidato'}</div>
            <div>{msg.body}</div>
            <div style={{ color: '#94a3b8', fontSize: 11 }}>{msg.createdAt ? new Date(msg.createdAt).toLocaleString('es-ES') : ''}</div>
          </div>
        ))}
        {messages.length === 0 && <div style={{ color: '#94a3b8' }}>No hay mensajes todavía.</div>}
      </div>
      <form onSubmit={onSend} style={{ display: 'flex', gap: 8 }}>
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Escribe un mensaje…"
          style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}
        />
        <button type="submit" style={{ borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', padding: '8px 12px' }}>Enviar</button>
      </form>
    </div>
  );
}
