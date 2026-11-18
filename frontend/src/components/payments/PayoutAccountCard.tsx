import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Landmark } from 'lucide-react';
import { createPayoutLink, getPayoutStatus, type PayoutStatus } from '../../services/connect';
import { apiErrorText } from '../../utils/apiErrors';
import { useToast } from '../../context/ToastContext';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import ErrorCard from '../ui/ErrorCard';

type Audience = 'landlord' | 'agency';

const COPY: Record<Audience, { what: string; pendingTitle: string; missingTitle: string; missingDetail: string }> = {
  landlord: {
    what: 'Las rentas que paguen tus inquilinos van directas a tu cuenta bancaria.',
    pendingTitle: 'Falta terminar el alta para poder cobrar',
    missingTitle: 'Activa tus cobros',
    missingDetail:
      'Hasta que conectes tu cuenta bancaria, tus inquilinos no pueden pagar la renta desde RentalApp. El alta se hace en Stripe y lleva unos cinco minutos: DNI e IBAN.',
  },
  agency: {
    what: 'Tus comisiones se transfieren a tu cuenta bancaria con cada renta cobrada.',
    pendingTitle: 'Falta terminar el alta para recibir comisiones',
    missingTitle: 'Conecta la cuenta donde cobrar tus comisiones',
    missingDetail:
      'Sin cuenta conectada no podemos transferirte las comisiones de tus contratos. El alta se hace en Stripe y lleva unos cinco minutos: datos fiscales e IBAN.',
  },
};

const pctText = (value: number) => `${value.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`;

/** Comisiones de la plataforma, dichas antes de activar los cobros. */
export function feeSentence(fees?: PayoutStatus['fees']) {
  if (!fees || (!fees.rentPct && !fees.signPct)) return '';
  const parts: string[] = [];
  if (fees.rentPct) parts.push(`${pctText(fees.rentPct)} de cada renta cobrada`);
  if (fees.signPct) parts.push(`${pctText(fees.signPct)} de la primera renta por la firma del contrato`);
  return `RentalApp descuenta ${parts.join(' y ')}. El resto llega íntegro a tu cuenta.`;
}

type Props = {
  audience: Audience;
  /** En el panel de agencia la tarjeta solo se enseña mientras falte algo. */
  hideWhenReady?: boolean;
};

export default function PayoutAccountCard({ audience, hideWhenReady = false }: Props) {
  const copy = COPY[audience];
  const { push } = useToast();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<PayoutStatus | null>(null);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setStatus(await getPayoutStatus());
    } catch (err) {
      setError(apiErrorText(err, 'No se pudo consultar el estado de tu cuenta de cobros.'));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Vuelta desde Stripe: ?connect=success | retry (ver /connect/return en el backend)
  const back = params.get('connect');
  useEffect(() => {
    if (!back) return;
    if (back === 'success') push({ title: 'Datos enviados a Stripe. Comprobamos el estado de tu cuenta.', tone: 'success' });
    if (back === 'retry') push({ title: 'El alta en Stripe quedó a medias. Puedes retomarla cuando quieras.', tone: 'info' });
    const next = new URLSearchParams(params);
    next.delete('connect');
    setParams(next, { replace: true });
  }, [back, params, push, setParams]);

  const openStripe = async () => {
    setOpening(true);
    try {
      window.location.assign(await createPayoutLink());
    } catch (err) {
      push({ title: apiErrorText(err, 'No se pudo abrir el alta en Stripe. Inténtalo de nuevo en unos minutos.'), tone: 'error' });
      setOpening(false);
    }
  };

  if (error) return <ErrorCard message={error} onRetry={() => void load()} />;
  if (!status) {
    return (
      <div className="rounded-2xl border border-[var(--ra-line)] bg-white p-5 text-sm text-[var(--ra-muted)] sm:p-6" aria-busy="true">
        Consultando tu cuenta de cobros…
      </div>
    );
  }
  if (status.ready && hideWhenReady) return null;

  const fees = audience === 'landlord' ? feeSentence(status.fees) : '';
  const deadline = status.requirements?.current_deadline
    ? new Date(status.requirements.current_deadline * 1000).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
    : '';

  if (status.ready) {
    return (
      <section className="rounded-2xl border border-[var(--ra-line)] bg-white p-5 sm:p-6" aria-labelledby="payout-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="payout-title" className="font-['Manrope'] text-lg font-bold text-[var(--ra-ink)]">Cuenta de cobros</h2>
                <Badge tone="success">Activa</Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--ra-muted)]">{copy.what}</p>
              {fees && <p className="mt-2 text-sm text-gray-700">{fees}</p>}
              {status.payouts_enabled === false && (
                <p className="mt-2 text-sm text-amber-800">
                  Stripe tiene retenidos los ingresos a tu banco hasta que revises tus datos{deadline ? ` (antes del ${deadline})` : ''}.
                </p>
              )}
            </div>
          </div>
          <Button variant="secondary" onClick={openStripe} disabled={opening} className="w-full shrink-0 sm:w-auto">
            {opening ? 'Abriendo Stripe…' : 'Cambiar datos bancarios'}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6" aria-labelledby="payout-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="payout-title" className="font-['Manrope'] text-lg font-bold text-[var(--ra-ink)]">
              {status.connected ? copy.pendingTitle : copy.missingTitle}
            </h2>
            <p className="mt-1 text-sm text-gray-800">
              {status.connected
                ? `Stripe todavía necesita algún dato para verificar tu cuenta${deadline ? ` (plazo: ${deadline})` : ''}. Retoma el alta donde la dejaste.`
                : copy.missingDetail}
            </p>
            {fees && <p className="mt-2 text-sm text-gray-800">{fees}</p>}
          </div>
        </div>
        <Button onClick={openStripe} disabled={opening} className="w-full shrink-0 sm:w-auto">
          {opening ? 'Abriendo Stripe…' : status.connected ? 'Terminar el alta' : 'Conectar cuenta bancaria'}
        </Button>
      </div>
    </section>
  );
}
