import React, { useState } from 'react';
import { Star } from 'lucide-react';
import Button from '../ui/Button';
import Stars from './Stars';
import { reviewTicketPro } from '../../services/reviews';

const SCORE_LABELS = ['', 'Mal', 'Regular', 'Bien', 'Muy bien', 'Excelente'];
const COMMENT_MAX = 1000;

type Mine = { score: number; comment?: string } | null;

type Props = {
  ticketId: string;
  proUserId: string;
  proName: string;
  canReview: boolean;
  mine: Mine;
  onSaved: () => void;
};

/** Valoración del profesional al cerrar la incidencia, o la que ya dejaste. */
export default function ProReviewForm({ ticketId, proUserId, proName, canReview, mine, onSaved }: Props) {
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');

  if (mine) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-900">Tu opinión sobre {proName}</p>
        <Stars score={mine.score} />
        {mine.comment && <p className="whitespace-pre-wrap text-sm text-gray-600 [overflow-wrap:anywhere]">{mine.comment}</p>}
      </div>
    );
  }
  if (!canReview) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!score) return;
    setState('sending');
    try {
      await reviewTicketPro(ticketId, proUserId, score, comment);
      onSaved();
    } catch (err: any) {
      // 409: ya la habías enviado (otra pestaña); recargar enseña la tuya
      if (err?.response?.status === 409) return onSaved();
      setState('error');
    }
  };

  const shown = hover || score;
  return (
    <form onSubmit={submit} className="space-y-3">
      <fieldset>
        <legend className="text-sm font-semibold text-gray-900">¿Qué tal el trabajo de {proName}?</legend>
        <p className="mt-0.5 text-xs text-gray-500">Tu opinión sale en su perfil con tu nombre y la inicial del apellido.</p>
        <div className="mt-2 flex items-center gap-3" onMouseLeave={() => setHover(0)}>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <label key={n} className="cursor-pointer rounded has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ra-blue)]" onMouseEnter={() => setHover(n)}>
                <input
                  type="radio"
                  name="pro-review-score"
                  value={n}
                  checked={score === n}
                  onChange={() => setScore(n)}
                  className="sr-only"
                  aria-label={`${n} de 5: ${SCORE_LABELS[n]}`}
                />
                <Star
                  size={26}
                  aria-hidden="true"
                  className={n <= shown ? 'fill-gray-900 text-gray-900' : 'fill-transparent text-gray-300'}
                />
              </label>
            ))}
          </div>
          <span className="text-sm text-gray-600" aria-live="polite">{SCORE_LABELS[shown]}</span>
        </div>
      </fieldset>
      <label className="block text-sm">
        <span className="text-gray-700">Comentario (opcional)</span>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value.slice(0, COMMENT_MAX))}
          rows={3}
          placeholder="Puntualidad, limpieza, si quedó bien arreglado…"
          className="mt-1 w-full rounded-lg border border-[var(--border)] p-2 text-sm"
        />
      </label>
      {state === 'error' && <p className="text-sm text-red-700">No se pudo enviar tu opinión. Inténtalo de nuevo.</p>}
      <Button type="submit" disabled={!score || state === 'sending'} className="w-full">
        {state === 'sending' ? 'Enviando…' : 'Enviar opinión'}
      </Button>
    </form>
  );
}
