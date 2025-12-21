import React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import Modal from '../ui/Modal';
import CheckoutForm from './CheckoutForm';

const stripeKey = process.env.REACT_APP_STRIPE_KEY || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_STRIPE_KEY);
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

interface Props {
  open: boolean;
  onClose: () => void;
  amountEUR: number;
  onSuccess: () => void;
  title?: string;
  description?: string;
  clientSecret?: string;
}

export default function PaymentModal({ open, onClose, amountEUR, onSuccess, title, description, clientSecret }: Props) {
  if (!stripeKey) {
    return (
      <Modal open={open} onClose={onClose} title="Error de Configuración">
        <div className="p-4 text-red-600">
          Falta la clave pública de Stripe (REACT_APP_STRIPE_KEY).
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={title || "Realizar Pago"}>
      <div className="space-y-4">
        {description && (
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-4">
            {description}
          </div>
        )}

        <Elements stripe={stripePromise!}>
          <CheckoutForm
            amount={Math.round(amountEUR * 100)}
            currency="eur"
            onSuccess={onSuccess}
            clientSecret={clientSecret}
          />
        </Elements>
      </div>
    </Modal>
  );
}
