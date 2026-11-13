import React, { useState } from 'react';
import { queryAssistant, type AssistantAnswer } from '../services/assistant';
import { apiErrorText } from '../utils/apiErrors';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ErrorCard from '../components/ui/ErrorCard';

// Los mismos límites que assistantQuerySchema (backend)
const MIN_LENGTH = 2;
const MAX_LENGTH = 2000;

const SUGGESTIONS = ['¿Cuándo termina mi contrato?', '¿Tengo algún pago pendiente?', '¿Cómo va mi incidencia?'];

const ERROR_TEXTS: Record<string, string> = {
  validation_error: `Escribe una pregunta de entre ${MIN_LENGTH} y ${MAX_LENGTH.toLocaleString('es-ES')} caracteres.`,
};

export default function AssistantPage() {
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState('');
  const [result, setResult] = useState<AssistantAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const trimmed = query.trim();
  const canAsk = trimmed.length >= MIN_LENGTH && trimmed.length <= MAX_LENGTH && !loading;

  const ask = async () => {
    if (!canAsk) return;
    setLoading(true);
    setError('');
    try {
      const res = await queryAssistant(trimmed);
      setAsked(trimmed);
      setResult(res);
    } catch (err: any) {
      setError(apiErrorText(err, 'Clara no ha podido responder ahora. Inténtalo de nuevo en unos minutos.', ERROR_TEXTS));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void ask();
  };

  // Cmd/Ctrl + Enter envía, como en el chat
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void ask();
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <PageHeader
        title="Asistente Clara"
        subtitle="Pregunta por tus contratos, pagos, incidencias y visitas. Clara responde con los datos de tu cuenta y la Ley de Arrendamientos Urbanos."
      />

      <Card className="p-5 sm:p-6">
        <form onSubmit={onSubmit} className="grid gap-4">
          <label className="ra-field">
            <span className="ra-field-label">Tu pregunta</span>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              rows={4}
              maxLength={MAX_LENGTH}
              placeholder="Por ejemplo: ¿cuánto me queda para renovar el contrato?"
              className="ra-input min-h-[112px] resize-y"
            />
          </label>

          <div className="flex flex-wrap gap-2" aria-label="Preguntas de ejemplo">
            {SUGGESTIONS.map((s) => (
              <Button key={s} variant="secondary" size="sm" onClick={() => setQuery(s)}>
                {s}
              </Button>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="ra-field-hint">
              {query.length.toLocaleString('es-ES')} / {MAX_LENGTH.toLocaleString('es-ES')} caracteres
            </p>
            <Button type="submit" disabled={!canAsk} className="w-full sm:w-auto">
              {loading ? 'Consultando…' : 'Preguntar'}
            </Button>
          </div>
        </form>
      </Card>

      {error && <ErrorCard message={error} onRetry={canAsk ? () => void ask() : undefined} />}

      {result && (
        <Card className="p-5 sm:p-6">
          <p className="text-sm text-gray-500">Has preguntado</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{asked}</p>
          <h2 className="mt-5 text-base font-semibold text-gray-950">Respuesta de Clara</h2>
          <div className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-gray-800">
            {result.answer || 'Clara no ha encontrado nada que responder. Prueba a preguntarlo de otra forma.'}
          </div>
          <p className="mt-5 border-t border-[var(--ra-line)] pt-4 text-xs leading-relaxed text-gray-500">
            Clara puede equivocarse. Para decisiones legales, revisa tu contrato o consulta a un profesional.
            {result.lau?.url && (
              <>
                {' '}Fuente legal:{' '}
                <a href={result.lau.url} target="_blank" rel="noreferrer" className="font-medium text-[var(--ra-blue)] underline">
                  Ley de Arrendamientos Urbanos{result.lau.versionDate ? ` (versión ${result.lau.versionDate})` : ''}
                </a>
                .
              </>
            )}
          </p>
        </Card>
      )}
    </div>
  );
}
