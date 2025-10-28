import React from 'react';

interface ChatMessage {
  id: string;
  author: string;
  body: string;
  timestamp: string;
}

interface ChatPanelProps {
  messages?: ChatMessage[];
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages = [] }) => (
  <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 16, background: '#fff', display: 'grid', gap: 12 }}>
    <h3 style={{ margin: 0 }}>Chat de la incidencia</h3>
    <div style={{ maxHeight: 260, overflow: 'auto', display: 'grid', gap: 8 }}>
      {messages.map(message => (
        <div key={message.id} style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>{message.author} · {new Date(message.timestamp).toLocaleString()}</span>
          <p style={{ margin: 0 }}>{message.body}</p>
        </div>
      ))}
      {messages.length === 0 && <p style={{ margin: 0, color: '#94a3b8' }}>Sin mensajes aún.</p>}
    </div>
    <textarea placeholder="Escribe un mensaje…" rows={3} style={{ border: '1px solid #cbd5f5', borderRadius: 12, padding: 12 }} />
    <div style={{ textAlign: 'right' }}>
      <button type="button" style={{ padding: '10px 12px', borderRadius: 12, border: 'none', background: '#111827', color: '#fff' }}>
        Enviar
      </button>
    </div>
  </div>
);

export default ChatPanel;
