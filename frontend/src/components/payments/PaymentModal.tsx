import React from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import Modal from '../ui/Modal';
import CheckoutForm from './CheckoutForm';
import { appEnv } from '../../config/env';

const stripeKey = appEnv.stripeKey;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const heading = title || 'Pagar';
  if (!stripeKey) {
    return (
      <Modal open={open} onClose={onClose} title={heading}>
        <p className="ra-pay-unavailable" role="alert">
          Los pagos con tarjeta no están disponibles ahora mismo. Inténtalo más tarde; no se te ha cobrado nada.
        </p>
        {import.meta.env.DEV && <p className="ra-pay-note">Falta VITE_STRIPE_KEY en el entorno del frontend.</p>}
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={heading}>
      <div className="ra-pay-summary">
        {description && <p className="ra-pay-concept">{description}</p>}
        <p className="ra-pay-amount">
          <span>Importe</span>
          <strong>{euros.format(amountEUR)}</strong>
        </p>
      </div>
      <Elements stripe={stripePromise!} options={{ locale: 'es' }}>
        <CheckoutForm
          amount={Math.round(amountEUR * 100)}
          currency="eur"
          onSuccess={onSuccess}
          clientSecret={clientSecret}
        />
      </Elements>
    </Modal>
  );
}
