import React, { useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { api as axios } from '../../api/client';
import { Lock } from 'lucide-react';

type Props = {
  amount: number; // céntimos
  currency?: string;
  onSuccess: () => void;
  clientSecret?: string;
};

// El campo de Stripe va en un iframe: no hereda la fuente ni los tokens, se le pasan a mano
const CARD_STYLE = {
  style: {
    base: {
      color: '#0b1025',
      fontFamily: '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
      fontSmoothing: 'antialiased',
      fontSize: '16px',
      '::placeholder': { color: '#66708b' },
    },
    invalid: { color: '#b42318', iconColor: '#b42318' },
  },
};

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CheckoutForm: React.FC<Props> = ({ amount, currency = 'eur', onSuccess, clientSecret }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!stripe || !elements) return;

    try {
      setLoading(true);
      let secret = clientSecret;
      if (!secret) {
        const { data } = await axios.post('/api/payments/create-intent', { amount, currency });
        secret = data.clientSecret;
      }
      const card = elements.getElement(CardElement);
      if (!secret || !card) throw new Error('No se pudo iniciar el pago');

      const result = await stripe.confirmCardPayment(secret, {
        payment_method: {
          card,
        },
      });

      if (result.error) {
        throw new Error(result.error.message);
      } else if (result.paymentIntent?.status === 'succeeded') {
        onSuccess();
      } else {
        throw new Error('El pago no se ha completado. Revisa la tarjeta o inténtalo de nuevo.');
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudo procesar el pago. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="ra-pay-form">
      <span className="ra-pay-label">Tarjeta</span>
      <div className="ra-pay-card">
        <CardElement options={{ style: CARD_STYLE.style, hidePostalCode: true }} />
      </div>

      {error && (
        <p className="ra-pay-error" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="ra-button ra-button-blue ra-pay-submit" disabled={!stripe || loading}>
        {loading ? 'Procesando el pago…' : `Pagar ${euros.format(amount / 100)}`}
      </button>

      <p className="ra-pay-note">
        <Lock size={13} aria-hidden /> Pago procesado por Stripe. RentalApp no guarda los datos de tu tarjeta.
      </p>
    </form>
  );
};

export default CheckoutForm;
