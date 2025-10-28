import React, { useMemo, useEffect, useState } from 'react';
import { createLegalDoc, getLegalDoc, listLegalVersions, type LegalDoc } from '../../api/legal';

type DocKey = 'terms' | 'privacy';

const sectionTitles: Record<DocKey, { title: string; description: string }> = {
  terms: {
    title: 'Términos y condiciones',
    description: 'Versión publicada de los términos de servicio que aceptan los usuarios.',
  },
  privacy: {
    title: 'Política de privacidad',
    description: 'Texto legal que explica cómo tratamos los datos personales.',
  },
};

type LegalState = {
  latest: LegalDoc | null;
  history: LegalDoc[];
};

type DraftState = {
  version: string;
  content: string;
  open: boolean;
};

const defaultDraft: DraftState = { version: '', content: '', open: false };

const AdminLegalPage: React.FC = () => {
  const [docs, setDocs] = useState<Record<DocKey, LegalState>>({
    terms: { latest: null, history: [] },
    privacy: { latest: null, history: [] },
  });
  const [drafts, setDrafts] = useState<Record<DocKey, DraftState>>({
    terms: defaultDraft,
    privacy: defaultDraft,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<DocKey | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadDocs = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const [termsLatest, privacyLatest, termsHistory, privacyHistory] = await Promise.all([
          getLegalDoc('terms'),
          getLegalDoc('privacy'),
          listLegalVersions('terms'),
          listLegalVersions('privacy'),
        ]);
        setDocs({
          terms: { latest: termsLatest, history: termsHistory },
          privacy: { latest: privacyLatest, history: privacyHistory },
        });
        setDrafts({
          terms: { ...defaultDraft },
          privacy: { ...defaultDraft },
        });
      } catch (err) {
        console.error('Error cargando textos legales', err);
        setError('No se pudieron cargar los textos legales.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const openDraft = (key: DocKey) => {
    const latest = docs[key].latest;
    setDrafts(prev => ({
      ...prev,
      [key]: {
        open: true,
        version: latest ? `${latest.version}-v${new Date().getFullYear()}` : '',
        content: latest?.content || '',
      },
    }));
    setSuccessMessage(null);
  };

  const closeDraft = (key: DocKey) => {
    setDrafts(prev => ({ ...prev, [key]: { ...defaultDraft } }));
  };

  const updateDraftField = (key: DocKey, field: keyof DraftState, value: string | boolean) => {
    setDrafts(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const submitDraft = async (key: DocKey) => {
    const draft = drafts[key];
    if (!draft.version.trim() || draft.content.trim().length < 10) {
      setError('Rellena versión y contenido (mínimo 10 caracteres).');
      return;
    }
    try {
      setSaving(key);
      setError(null);
      await createLegalDoc(key, draft.version.trim(), draft.content);
      setSuccessMessage('Nuevo texto guardado correctamente.');
      await loadDocs();
    } catch (err: any) {
      console.error('Error guardando texto legal', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || 'Error guardando el texto.';
      setError(msg);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header>
        <h1 style={{ marginBottom: 4 }}>Textos legales</h1>
        <p style={{ margin: 0, color: '#475569' }}>
          Consulta las versiones vigentes y publica nuevas ediciones cuando el equipo legal lo solicite.
        </p>
      </header>
      <div style={{ display: 'flex', gap: 12 }}>
        <button type="button" onClick={loadDocs} style={buttonSecondaryStyle}>Actualizar</button>
        {successMessage && <span style={{ color: '#047857', fontWeight: 600 }}>{successMessage}</span>}
      </div>
      {loading && <p style={{ margin: 0 }}>Cargando textos…</p>}
      {error && (
        <div style={{ padding: 16, borderRadius: 12, background: '#fee2e2', color: '#991b1b' }}>
          {error}
        </div>
      )}
      {!loading && !error && (
        <div style={{ display: 'grid', gap: 20 }}>
          {(['terms', 'privacy'] as DocKey[]).map(key => {
            const { latest, history } = docs[key];
            const draft = drafts[key];
            const title = sectionTitles[key];
            return (
              <section key={key} style={cardStyle}>
                <header style={{ marginBottom: 12 }}>
                  <h2 style={{ margin: 0 }}>{title.title}</h2>
                  <p style={{ margin: '4px 0', color: '#64748b' }}>{title.description}</p>
                  {latest && (
                    <small style={{ color: '#475569', fontWeight: 600 }}>Versión vigente: {latest.version}</small>
                  )}
                </header>
                <textarea
                  value={latest?.content || 'Sin contenido disponible'}
                  readOnly
                  style={textareaStyle}
                />
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  {!draft.open ? (
                    <button type="button" style={buttonPrimaryStyle} onClick={() => openDraft(key)}>
                      Nueva versión
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        style={buttonSecondaryStyle}
                        onClick={() => closeDraft(key)}
                        disabled={saving === key}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        style={buttonPrimaryStyle}
                        onClick={() => submitDraft(key)}
                        disabled={saving === key}
                      >
                        {saving === key ? 'Guardando…' : 'Guardar nueva versión'}
                      </button>
                    </>
                  )}
                </div>
                {draft.open && (
                  <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={labelStyle}>Versión</span>
                      <input
                        type="text"
                        value={draft.version}
                        onChange={event => updateDraftField(key, 'version', event.target.value)}
                        style={inputStyle}
                        placeholder="Ej.: v2"
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span style={labelStyle}>Contenido</span>
                      <textarea
                        value={draft.content}
                        onChange={event => updateDraftField(key, 'content', event.target.value)}
                        style={{ ...textareaStyle, background: '#fff' }}
                        rows={12}
                      />
                    </label>
                  </div>
                )}
                {history.length > 0 && (
                  <details style={{ marginTop: 16 }}>
                    <summary style={{ cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 }}>
                      Histórico ({history.length})
                    </summary>
                    <ul style={{ marginTop: 12, paddingLeft: 16, color: '#475569', display: 'grid', gap: 6 }}>
                      {history.map(doc => (
                        <li key={`${doc.slug}-${doc.version}`}>
                          <strong>{doc.version}</strong> · {new Date(doc.createdAt || '').toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 24,
  background: '#fff',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
  display: 'grid',
  gap: 12,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 220,
  resize: 'vertical' as const,
  borderRadius: 12,
  border: '1px solid #cbd5f5',
  padding: 16,
  fontFamily: 'inherit',
  background: '#f8fafc',
};

const inputStyle: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid #cbd5f5',
  padding: '10px 14px',
  fontSize: 15,
};

const buttonPrimaryStyle: React.CSSProperties = {
  borderRadius: 12,
  border: 'none',
  padding: '10px 18px',
  background: '#1d4ed8',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const buttonSecondaryStyle: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid #cbd5f5',
  padding: '10px 18px',
  background: '#fff',
  color: '#1d4ed8',
  fontWeight: 600,
  cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  fontWeight: 600,
  color: '#1f2937',
};

export default AdminLegalPage;
