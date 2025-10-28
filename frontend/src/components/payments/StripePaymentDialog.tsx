import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';

interface Props {
  clientSecret: string | null;
  open: boolean;
  onClose: (completed?: boolean) => void;
}

const publishableKey =
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY ||
  (process.env as any).REACT_APP_STRIPE_PK ||
  (process.env as any).VITE_STRIPE_PK ||
  '';

const stripePromise = publishableKey ? loadStripe(publishableKey) : Promise.resolve(null);

const dialogBackdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000,
};

const dialogCard: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 24,
  width: 'min(420px, 90vw)',
  boxShadow: '0 30px 60px rgba(15,23,42,0.25)',
  display: 'grid',
  gap: 16,
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  fontWeight: 600,
  cursor: 'pointer',
};

function StripePaymentDialog({ clientSecret, open, onClose }: Props) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [elements, setElements] = useState<StripeElements | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);
  const paymentElementRef = useRef<any>(null);

  const ready = useMemo(() => !!clientSecret && !!open, [clientSecret, open]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      if (!ready) return;
      const stripeInstance = await stripePromise;
      if (!mounted) return;
      if (!stripeInstance) {
        setError('Stripe no está configurado (falta la clave pública REACT_APP_STRIPE_PUBLISHABLE_KEY).');
        return;
      }
      if (!clientSecret) return;
      const elementsInstance = stripeInstance.elements({
        clientSecret,
        appearance: { theme: 'flat' },
      });
      const paymentElement = elementsInstance.create('payment');
      paymentElement.mount(elementRef.current!);
      paymentElementRef.current = paymentElement;
      setStripe(stripeInstance);
      setElements(elementsInstance);
      setError(null);
    }
    init();
    return () => {
      mounted = false;
      if (paymentElementRef.current) {
        paymentElementRef.current.destroy();
        paymentElementRef.current = null;
      }
      setElements(null);
      setStripe(null);
      setError(null);
      setProcessing(false);
    };
  }, [clientSecret, ready]);

  const close = useCallback(
    (completed?: boolean) => {
      onClose(completed);
    },
    [onClose],
  );

  const confirm = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!stripe || !elements) return;
      setProcessing(true);
      setError(null);
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: undefined },
        redirect: 'if_required',
      });
      if (result.error) {
        setError(result.error.message || 'No se pudo confirmar el pago');
        setProcessing(false);
        return;
      }
      setProcessing(false);
      close(true);
    },
    [stripe, elements, close],
  );

  if (!open) return null;

  if (!publishableKey) {
    return (
      <div style={dialogBackdrop} role="dialog" aria-modal="true">
        <div style={dialogCard}>
          <h3 style={{ margin: 0 }}>Stripe no configurado</h3>
          <p style={{ margin: 0 }}>
            Define la variable <code>REACT_APP_STRIPE_PUBLISHABLE_KEY</code> para poder completar el pago en el
            frontend.
          </p>
          <button
            type="button"
            onClick={() => close(false)}
            style={{ ...buttonStyle, background: '#1f2937', color: '#fff' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={dialogBackdrop} role="dialog" aria-modal="true">
      <form style={dialogCard} onSubmit={confirm}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>Completa el pago</h3>
          <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>
            Introduce tu método de pago para confirmar la transacción. No serás redirigido si el proveedor no lo
            requiere.
          </p>
        </div>
        <div ref={elementRef} />
        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', fontSize: 14 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={() => close(false)}
            style={{ ...buttonStyle, background: '#e2e8f0', color: '#1f2937' }}
            disabled={processing}
          >
            Cancelar
          </button>
          <button
            type="submit"
            style={{ ...buttonStyle, background: '#111827', color: '#fff' }}
            disabled={processing || !stripe || !elements}
          >
            {processing ? 'Confirmando…' : 'Confirmar pago'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default StripePaymentDialog;
