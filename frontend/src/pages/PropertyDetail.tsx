import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProperty } from '../services/properties';
import { createPaymentIntent } from '../services/payments';
import { downloadDemoContract } from '../services/contracts';
import { loadStripe, Stripe, StripeCardElement } from '@stripe/stripe-js';

type Params = { id: string };

const PropertyDetail: React.FC = () => {
  const { id } = useParams<Params>();
  const [property, setProperty] = useState<any>();
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [card, setCard] = useState<StripeCardElement | null>(null);
  const token = localStorage.getItem('token') || '';

  useEffect(() => {
    if (id) getProperty(id).then(setProperty);
  }, [id]);

  useEffect(() => {
    loadStripe(process.env.REACT_APP_STRIPE_PK || '').then(s => {
      if (s) {
        const elements = s.elements();
        const cardEl = elements.create('card');
        cardEl.mount('#card-element');
        setStripe(s);
        setCard(cardEl);
      }
    });
  }, []);

  const handlePay = async () => {
    if (!stripe || !card || !property) return;
    const clientSecret = await createPaymentIntent(token, property.price);
    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card },
    });
    if (error) {
      alert(error.message);
    } else if (paymentIntent?.status === 'succeeded') {
      const blob = await downloadDemoContract(token, { landlord: property.ownerId, property: property.title, rent: property.price });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  if (!property) return <div>Cargando...</div>;
  return (
    <div>
      <h1>{property.title}</h1>
      <p>{property.address}</p>
      <div id="card-element" style={{ border: '1px solid #ccc', padding: '10px' }}></div>
      <button onClick={handlePay}>Pagar</button>
    </div>
  );
};

export default PropertyDetail;
