import React, { useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import axios from 'axios';

type CheckoutFormProps = {
  amount: number; // en la moneda indicada (cents)
  currency?: string; // ej. 'eur'
};

export const CheckoutForm: React.FC<CheckoutFormProps> = ({ amount, currency = 'eur' }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!stripe || !elements) {
      setError('Stripe no está listo');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post('/api/payments/create-intent', { amount, currency });
      const clientSecret = res.data?.clientSecret;
      if (!clientSecret) throw new Error('No se pudo obtener el clientSecret');

      const card = elements.getElement(CardElement);
      if (!card) throw new Error('No se encontró el CardElement');

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
        },
      });

      if (result.error) {
        setError(result.error.message || 'Error en el pago');
      } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        setSuccess('Pago completado correctamente');
      } else {
        setError('No se pudo completar el pago');
      }
    } catch (err: any) {
      setError(err?.message || 'Error procesando el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, maxWidth: 420 }}>
      <CardElement options={{ hidePostalCode: true }} />
      {error && <div style={{ color: 'red', fontSize: 14 }}>{error}</div>}
      {success && <div style={{ color: 'green', fontSize: 14 }}>{success}</div>}
      <button
        type="submit"
        disabled={loading || !stripe || !elements}
        style={{ padding: '10px 12px', borderRadius: 8, background: '#111827', color: 'white', fontWeight: 700 }}
      >
        {loading ? 'Procesando...' : `Pagar ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`}
      </button>
    </form>
  );
};

export default CheckoutForm;

