import React, { useCallback, useEffect, useState } from 'react';
import { TrendingUp, RefreshCw, Info, ShieldAlert } from 'lucide-react';
import Button from './ui/Button';
import { getRentSuggestion, RentSuggestion, RentSuggestionInput } from '../services/properties';

type Props = {
  input: RentSuggestionInput;
  onApply: (price: number) => void;
};

function basisLabel(suggestion: RentSuggestion) {
  const { basis } = suggestion;
  if (basis.source === 'own_listings') {
    const where =
      basis.scope === 'radius' && basis.radiusKm
        ? `a menos de ${basis.radiusKm} km`
        : 'en tu ciudad';
    return `Media de ${basis.sampleSize} anuncios ${where}`;
  }
  const period = basis.reference?.period ? ` (${basis.reference.period})` : '';
  return `Índice oficial de referencia${period}`;
}

export default function RentSuggestionCard({ input, onApply }: Props) {
  const [suggestion, setSuggestion] = useState<RentSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const ready = Boolean(input.region && input.city && input.sizeM2 > 0);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setMessage('');
    try {
      const { suggestion: result } = await getRentSuggestion(input);
      setSuggestion(result);
      if (!result) {
        setMessage('Todavía no hay datos suficientes de tu zona para sugerir un precio.');
      }
    } catch {
      setSuggestion(null);
      setMessage('No se pudo calcular la sugerencia. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
    // The input object is rebuilt on every render, so depend on its values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    input.region,
    input.city,
    input.sizeM2,
    input.condition,
    input.furnished,
    input.floor,
    input.hasElevator,
    input.yearBuilt,
    input.location?.lat,
    input.location?.lng,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  if (!ready) return null;

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-indigo-900">
          <TrendingUp size={18} />
          <span className="font-semibold text-sm">Precio sugerido para tu zona</span>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
          aria-label="Recalcular sugerencia"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !suggestion && (
        <p className="mt-3 text-sm text-indigo-800/70">Calculando…</p>
      )}

      {!loading && !suggestion && message && (
        <p className="mt-3 flex items-start gap-2 text-sm text-indigo-900/80">
          <Info size={15} className="mt-0.5 shrink-0" />
          <span>{message}</span>
        </p>
      )}

      {suggestion && (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-bold text-indigo-950">
              {suggestion.suggested.toLocaleString('es-ES')} €
            </span>
            <span className="text-sm text-indigo-900/70">
              rango {suggestion.range.min.toLocaleString('es-ES')}–
              {suggestion.range.max.toLocaleString('es-ES')} €
            </span>
          </div>

          <p className="mt-1 text-xs text-indigo-900/70">
            {basisLabel(suggestion)} · {suggestion.pricePerM2.toLocaleString('es-ES')} €/m²
          </p>

          {suggestion.adjustments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestion.adjustments.map(adjustment => (
                <span
                  key={adjustment.key}
                  className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-indigo-800 border border-indigo-100"
                >
                  {adjustment.label} {adjustment.factor >= 1 ? '+' : '−'}
                  {Math.abs(Math.round((adjustment.factor - 1) * 100))}%
                </span>
              ))}
            </div>
          )}

          {suggestion.cap?.applied && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              <span>
                Tu vivienda está en zona tensionada: la renta no puede superar{' '}
                <strong>{suggestion.cap.maxRent.toLocaleString('es-ES')} €</strong>, así que la
                sugerencia se ha ajustado a ese límite.
              </span>
            </p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <Button type="button" size="sm" onClick={() => onApply(suggestion.suggested)}>
              Usar este precio
            </Button>
            <span className="text-[11px] text-indigo-900/60">
              Es una orientación, no una tasación.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
