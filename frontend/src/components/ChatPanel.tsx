import React, { useEffect, useRef, useState } from 'react';
import { ensureConversation, getMessages, sendMessage, markRead, type Message } from '../services/chat';
import { useAuth } from '../context/AuthContext';
import { api as axios } from '../api/client';
import { toAbsoluteUrl } from '../utils/media';

export default function ChatPanel({ kind, refId }: { kind: 'direct'|'ticket'|'contract'|'appointment'; refId: string }) {
  const [conversationId, setConversationId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [participantName, setParticipantName] = useState<string>('Conversación');
  const [isDragging, setIsDragging] = useState(false);
  const myId = (user as any)?.id || (user as any)?._id;
  const isImageUrl = (u?: string) => !!u && /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(u);
  const isPdfUrl = (u?: string) => !!u && /\.pdf(?:$|\?)/i.test(u);
  const fileNameFromUrl = (u?: string) => {
    try {
      if (!u) return '';
      const p = u.split('?')[0];
      const seg = p.split('/');
      return seg[seg.length - 1] || 'archivo';
    } catch { return 'archivo'; }
  };

  useEffect(() => {
    (async () => {
      if (!refId) return;
      const conv = await ensureConversation(kind, refId);
      setConversationId(conv._id);
      const other = conv.participantsInfo?.find(p => p.id !== String(myId));
      setParticipantName(other?.name || 'Conversación');
      const msgs = await getMessages(conv._id, { limit: 50 });
      // backend devuelve descendente; mostramos ascendente
      setMessages(msgs.slice().reverse());
      // scroll bottom
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }), 0);
      // marca como leído para el usuario actual
      try { await markRead(conv._id); } catch {}
    })();
  }, [kind, refId]);

  const onSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!conversationId || (!body.trim() && !attachmentUrl)) return;
    const msg = await sendMessage(conversationId, body.trim(), attachmentUrl);
    setMessages((prev) => [...prev, msg]);
    setBody('');
    setAttachmentUrl(undefined);
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 0);
    try { await markRead(conversationId); } catch {}
  };

  const loadMore = async () => {
    if (!conversationId || messages.length === 0 || loadingMore) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const older = await getMessages(conversationId, { before: oldest.createdAt, limit: 50 });
      const olderAsc = older.slice().reverse();
      if (olderAsc.length) setMessages(prev => [...olderAsc, ...prev]);
    } finally {
      setLoadingMore(false);
    }
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setUploadError(null);
    const form = new FormData();
    form.append('files', file);
    try {
      setUploading(true);
      const res = await axios.post('/api/uploads/images', form);
      const urls: string[] = res.data?.urls || [];
      if (urls.length > 0) setAttachmentUrl(urls[0]);
      else setUploadError('No se devolvió URL');
    } catch (e: any) {
      setUploadError(e?.response?.data?.error || e?.message || 'Error subiendo archivo');
    } finally {
      setUploading(false);
    }
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave: React.DragEventHandler<HTMLDivElement> = () => setIsDragging(false);
  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) await onPickFile(f);
  };

  if (!refId) return null;
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{participantName}</p>
          <p className="text-xs text-gray-500">Chat de la incidencia</p>
        </div>
        <button
          onClick={loadMore}
          disabled={loadingMore || !messages.length}
          className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loadingMore ? 'Cargando…' : 'Cargar anteriores'}
        </button>
      </div>

      <div
        ref={listRef}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
        style={{
          background: isDragging ? '#e0f2fe' : '#efeae2',
          outline: isDragging ? '2px dashed #38bdf8' : 'none',
          transition: 'background 120ms',
        }}
        title="Arrastra y suelta archivos para adjuntar"
      >
        {messages.map((m) => {
          const mine = m.senderId === myId;
          return (
            <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow ${
                  mine ? 'bg-green-100 text-gray-900' : 'bg-white text-gray-900'
                }`}
              >
                {m.type === 'system' ? (
                  <em className="text-xs text-gray-500">[{m.systemCode}]</em>
                ) : (
                  <>
                    {m.body && <div className="whitespace-pre-wrap">{m.body}</div>}
                    {(m as any).attachmentUrl && (
                      <div className="mt-2">
                        {isImageUrl((m as any).attachmentUrl) ? (
                          <a href={toAbsoluteUrl((m as any).attachmentUrl)} target="_blank" rel="noreferrer">
                            <img
                              src={toAbsoluteUrl((m as any).attachmentUrl)}
                              alt="adjunto"
                              className="max-h-48 rounded-lg border border-gray-200 object-cover"
                            />
                          </a>
                        ) : isPdfUrl((m as any).attachmentUrl) ? (
                          <a href={toAbsoluteUrl((m as any).attachmentUrl)} target="_blank" rel="noreferrer" className="text-blue-600">
                            📄 {fileNameFromUrl((m as any).attachmentUrl)}
                          </a>
                        ) : (
                          <a href={toAbsoluteUrl((m as any).attachmentUrl)} target="_blank" rel="noreferrer" className="text-blue-600">
                            {fileNameFromUrl((m as any).attachmentUrl)}
                          </a>
                        )}
                      </div>
                    )}
                  </>
                )}
                <div className={`mt-1 text-[11px] ${mine ? 'text-green-700' : 'text-gray-500'} text-right`}>
                  {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ''}
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && <div className="text-center text-sm text-gray-500">No hay mensajes.</div>}
      </div>

      <form onSubmit={onSend} className="flex items-center gap-2 border-t border-gray-100 bg-white px-3 py-3">
        <label className="cursor-pointer rounded-full bg-gray-100 p-2 text-sm hover:bg-gray-200" title="Abrir cámara (móvil)">
          📷
          <input type="file" onChange={(e)=>onPickFile(e.target.files?.[0] || null)} className="hidden" accept="image/*" capture="environment" />
        </label>
        <label className="cursor-pointer rounded-full bg-gray-100 p-2 text-sm hover:bg-gray-200">
          📎
          <input type="file" onChange={(e)=>onPickFile(e.target.files?.[0] || null)} className="hidden" accept="image/*,.pdf" />
        </label>
        <input
          value={body}
          onChange={(e)=>setBody(e.target.value)}
          onPaste={async (e) => {
            try { const f = e.clipboardData?.files?.[0]; if (f) await onPickFile(f); } catch {}
          }}
          placeholder="Escribe un mensaje..."
          className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
        />
        <button type="submit" className="rounded-full bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50" disabled={!body.trim() && !attachmentUrl}>
          Enviar
        </button>
      </form>
      {attachmentUrl && (
        <div className="px-4 pb-3 text-xs text-gray-600">
          Adjuntando: {isImageUrl(attachmentUrl) ? (
            <a href={attachmentUrl} target="_blank" rel="noreferrer" className="text-blue-600">imagen</a>
          ) : isPdfUrl(attachmentUrl) ? (
            <a href={attachmentUrl} target="_blank" rel="noreferrer" className="text-blue-600">📄 {fileNameFromUrl(attachmentUrl)}</a>
          ) : (
            <a href={attachmentUrl} target="_blank" rel="noreferrer" className="text-blue-600">{fileNameFromUrl(attachmentUrl)}</a>
          )}
        </div>
      )}
      {uploadError && <div className="px-4 pb-3 text-xs text-red-600">{uploadError}</div>}
    </div>
  );
}
