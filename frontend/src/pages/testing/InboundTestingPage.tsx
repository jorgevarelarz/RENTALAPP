import React, { useEffect, useMemo, useState } from 'react';
import {
  getInboundLead,
  listInboundLeads,
  simulateInboundWebhook,
  type InboundLeadResponse,
  type LeadChanges,
  type LeadDetail,
  type LeadSummary,
  type LeadTimelineEntry,
} from '../../services/inboundTesting';

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  background: '#fff',
  padding: 20,
  boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
};

export default function InboundTestingPage() {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [externalLeadId, setExternalLeadId] = useState('demo-testing-lead');
  const [message, setMessage] = useState('Quiero vender mi piso en Chamberi por 450000 euros, tiene 95 m2 y 3 habitaciones.');
  const [awaitingUserReply, setAwaitingUserReply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<InboundLeadResponse | null>(null);

  const currentLead = useMemo(() => {
    if (result && selectedLead && String(selectedLead._id) === result.leadId) {
      return {
        ...selectedLead,
        leadType: result.leadType,
        leadStatus: result.leadStatus,
        conversationStage: result.conversationStage,
        qualificationScore: result.qualificationScore,
        nextBestAction: result.nextBestAction,
        suggestedQuestions: result.suggestedQuestions,
        messageCount: result.messageCount,
        awaitingUserReply: result.awaitingUserReply,
        missingFields: result.missingFields,
        scoreReasons: result.scoreReasons,
        extractedData: result.extractedData,
        timeline: result.timeline,
      } as LeadDetail;
    }
    return selectedLead;
  }, [result, selectedLead]);

  useEffect(() => {
    void loadLeads();
  }, []);

  useEffect(() => {
    if (!selectedLeadId) return;
    void loadLead(selectedLeadId);
  }, [selectedLeadId]);

  async function loadLeads(preferredLeadId?: string) {
    try {
      setLoadingLeads(true);
      const items = await listInboundLeads();
      setLeads(items);
      const nextLeadId = preferredLeadId || selectedLeadId || items[0]?._id || '';
      if (nextLeadId) {
        setSelectedLeadId(nextLeadId);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'No se pudo cargar el historico');
    } finally {
      setLoadingLeads(false);
    }
  }

  async function loadLead(leadId: string) {
    try {
      const data = await getInboundLead(leadId);
      setSelectedLead(data);
      setExternalLeadId(data.externalLeadId);
      setAwaitingUserReply(data.awaitingUserReply);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'No se pudo cargar el lead');
    }
  }

  const handleSelectLead = (lead: LeadSummary) => {
    setSelectedLeadId(lead._id);
    setExternalLeadId(lead.externalLeadId);
    setResult(null);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    try {
      setLoading(true);
      setError('');
      const data = await simulateInboundWebhook({
        leadId: selectedLeadId || undefined,
        externalLeadId: externalLeadId.trim() || undefined,
        message: message.trim(),
        awaitingUserReply,
      });
      setResult(data);
      setMessage('');
      await loadLeads(data.leadId);
      await loadLead(data.leadId);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'No se pudo simular el inbound');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Testing inbound</h1>
        <p className="mt-2 text-sm text-slate-600">
          Entorno aislado de seguimiento comercial multi-turn para leads simulados.
        </p>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[280px_1fr_360px]">
        <aside style={cardStyle} className="grid gap-4 self-start">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Leads recientes</h2>
            <button
              type="button"
              onClick={() => void loadLeads()}
              className="text-xs font-semibold text-blue-700"
            >
              Recargar
            </button>
          </div>

          <div className="grid gap-2">
            {loadingLeads ? (
              <div className="text-sm text-slate-500">Cargando leads...</div>
            ) : leads.length ? leads.map((lead) => (
              <button
                key={lead._id}
                type="button"
                onClick={() => handleSelectLead(lead)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  selectedLeadId === lead._id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="text-sm font-semibold">{lead.externalLeadId}</div>
                <div className={`mt-1 text-xs ${selectedLeadId === lead._id ? 'text-slate-200' : 'text-slate-500'}`}>
                  {lead.leadType} · {lead.leadStatus}
                </div>
                <div className={`mt-1 text-xs ${selectedLeadId === lead._id ? 'text-slate-200' : 'text-slate-500'}`}>
                  score {lead.qualificationScore} · {lead.messageCount} mensajes
                </div>
              </button>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-3 py-8 text-center text-sm text-slate-500">
                Aun no hay leads simulados.
              </div>
            )}
          </div>
        </aside>

        <section className="grid gap-6">
          <form onSubmit={handleSubmit} style={cardStyle} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                External lead ID
                <input
                  value={externalLeadId}
                  onChange={(e) => setExternalLeadId(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                  placeholder="lead-123"
                />
              </label>

              <label className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={awaitingUserReply}
                  onChange={(e) => setAwaitingUserReply(e.target.checked)}
                />
                El sistema ya respondió y ahora espera contestación
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Nuevo mensaje inbound
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Escribe aqui el siguiente mensaje del lead..."
              />
            </label>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? 'Procesando...' : selectedLeadId ? 'Continuar conversación' : 'Crear / continuar lead'}
              </button>
              <span className="text-xs text-slate-500">
                Reutilizamos el mismo lead si coincide `leadId` o `externalLeadId`.
              </span>
            </div>
          </form>

          <div style={cardStyle} className="grid gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Timeline del lead</h2>
              {currentLead ? (
                <span className="text-xs text-slate-500">
                  {currentLead.messageCount} mensajes inbound procesados
                </span>
              ) : null}
            </div>

            {!currentLead ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                Selecciona un lead o crea uno nuevo para ver su evolución.
              </div>
            ) : (
              <div className="grid gap-3">
                {currentLead.timeline.map((entry, index) => (
                  <TimelineEntry key={`${entry.createdAt}-${index}`} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside style={cardStyle} className="grid gap-4 self-start">
          <h2 className="text-lg font-semibold text-slate-900">Estado actual</h2>

          {!currentLead ? (
            <div className="text-sm text-slate-500">Sin lead seleccionado.</div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <Metric label="Lead type" value={currentLead.leadType} />
                <Metric label="Lead status" value={currentLead.leadStatus} />
                <Metric label="Conversation stage" value={currentLead.conversationStage} />
                <Metric label="Qualification score" value={`${currentLead.qualificationScore}`} />
                <Metric label="Message count" value={`${currentLead.messageCount}`} />
                <Metric label="Awaiting user reply" value={currentLead.awaitingUserReply ? 'Yes' : 'No'} />
              </div>

              <InfoBlock label="Next best action" value={currentLead.nextBestAction || '-'} />

              <TagSection label="Suggested questions" items={currentLead.suggestedQuestions} tone="blue" emptyLabel="No hay preguntas sugeridas." />
              <TagSection label="Missing fields" items={currentLead.missingFields} tone="amber" emptyLabel="No faltan campos clave." />
              <TagSection label="Score reasons" items={currentLead.scoreReasons} tone="emerald" emptyLabel="No hay motivos de score disponibles." />

              <div className="grid gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Datos extraídos</div>
                <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(currentLead.extractedData, null, 2)}
                </pre>
              </div>

              {result?.changes ? (
                <div className="grid gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cambios del último mensaje</div>
                  <ChangeSummary changes={result.changes} />
                </div>
              ) : null}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function TimelineEntry({ entry }: { entry: LeadTimelineEntry }) {
  const isInbound = entry.direction === 'inbound';
  return (
    <div className={`rounded-2xl border px-4 py-3 ${isInbound ? 'border-slate-200 bg-slate-50' : 'border-blue-200 bg-blue-50'}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${isInbound ? 'bg-slate-900 text-white' : 'bg-blue-700 text-white'}`}>
          {entry.direction}
        </span>
        <span className="text-xs text-slate-500">
          {new Date(entry.createdAt).toLocaleString('es-ES')}
        </span>
      </div>
      <div className="whitespace-pre-wrap text-sm text-slate-700">{entry.body}</div>
      {entry.changes && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <ChangeSummary changes={entry.changes} compact />
        </div>
      )}
    </div>
  );
}

function ChangeSummary({ changes, compact = false }: { changes: LeadChanges; compact?: boolean }) {
  const rows = [
    changes.qualificationScore ? `score ${changes.qualificationScore.previous ?? '-'} -> ${changes.qualificationScore.current ?? '-'}` : null,
    changes.conversationStage ? `stage ${changes.conversationStage.previous ?? '-'} -> ${changes.conversationStage.current ?? '-'}` : null,
    changes.leadStatus ? `status ${changes.leadStatus.previous ?? '-'} -> ${changes.leadStatus.current ?? '-'}` : null,
    changes.newExtractedFields?.length ? `nuevos campos: ${changes.newExtractedFields.join(', ')}` : null,
  ].filter(Boolean) as string[];

  if (!rows.length) {
    return <div className="text-xs text-slate-500">Sin cambios estructurales en este turno.</div>;
  }

  return (
    <div className={`grid gap-1 ${compact ? 'text-xs' : 'text-sm'} text-slate-700`}>
      {rows.map((row) => (
        <div key={row}>{row}</div>
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">{value}</div>
    </div>
  );
}

function TagSection({
  label,
  items,
  tone,
  emptyLabel,
}: {
  label: string;
  items: string[];
  tone: 'blue' | 'amber' | 'emerald';
  emptyLabel: string;
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };

  return (
    <div className="grid gap-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items.length ? items.map((item) => (
          <span key={item} className={`rounded-full border px-3 py-1.5 text-sm ${tones[tone]}`}>
            {item}
          </span>
        )) : (
          <span className="text-sm text-slate-500">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}
