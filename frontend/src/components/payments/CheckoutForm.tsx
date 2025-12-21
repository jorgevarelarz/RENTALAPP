import React, { useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import axios from 'axios';
import Button from '../ui/Button';
import { Lock } from 'lucide-react';

type Props = {
  amount: number; // céntimos
  currency?: string;
  onSuccess: () => void;
  clientSecret?: string;
};

const CARD_STYLE = {
  style: {
    base: {
      color: "#32325d",
      fontFamily: '"Inter", sans-serif',
      fontSmoothing: "antialiased",
      fontSize: "16px",
      "::placeholder": {
        color: "#aab7c4"
      }
    },
    invalid: {
      color: "#fa755a",
      iconColor: "#fa755a"
    }
  }
};

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
        throw new Error('Pago no completado');
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el pago.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-4 border border-gray-300 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">
        <CardElement options={{ style: CARD_STYLE.style, hidePostalCode: true }} />
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 animate-in fade-in">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full flex items-center justify-center gap-2 py-3 text-lg"
      >
        {loading ? 'Procesando...' : (
          <>
            <Lock size={18} /> Pagar {((amount / 100).toFixed(2))} €
          </>
        )}
      </Button>

      <div className="text-center text-xs text-gray-400 flex items-center justify-center gap-1">
        <Lock size={12} /> Pagos seguros encriptados por Stripe
      </div>
    </form>
  );
};

export default CheckoutForm;
