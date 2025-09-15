import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getProperty } from '../services/properties';
import { createPaymentIntent } from '../services/payments';
import { downloadDemoContract } from '../services/contracts';
import { loadStripe, Stripe, StripeCardElement } from '@stripe/stripe-js';
import { useAuth } from '../auth/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { useToast } from '../context/ToastContext';
import Gallery from '../components/ui/Gallery';
import { useDocumentTitle } from '../utils/useDocumentTitle';

type Params = { id: string };

const PropertyDetail: React.FC = () => {
  const { id } = useParams<Params>();
  const [property, setProperty] = useState<any>();
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [card, setCard] = useState<StripeCardElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'paying' | 'success' | 'error'>('idle');

  const { token, user } = useAuth();
  const { push } = useToast();
  useDocumentTitle(property?.title || 'Propiedad');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!id) return;
        setLoading(true); setLoadError('');
        const p = await getProperty(id);
        if (mounted) setProperty(p);
      } catch (e: any) {
        if (mounted) setLoadError(e?.message || 'No se pudo cargar la propiedad');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    const pk = process.env.REACT_APP_STRIPE_PK || '';
    if (!pk) return; // no montar si falta clave
    let cancelled = false;
    (async () => {
      try {
        const s = await loadStripe(pk);
        if (!s || cancelled) return;
        const elements = s.elements();
        const el = elements.create('card');
        // esperar al siguiente tick para asegurar el nodo existe
        setTimeout(() => {
          if (cancelled) return;
          const host = document.getElementById('card-element');
          if (!host) return;
          el.mount('#card-element');
          setStripe(s);
          setCard(el);
        }, 0);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePay = async () => {
    if (!stripe || !card || !property) return;

    try {
      setStatus('paying');
      const clientSecret = await createPaymentIntent(token || '', property.price);
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });
      if (error) {
        setStatus('error');
        push({ title: error.message || 'Error en el pago', tone: 'error' });
      } else if (paymentIntent?.status === 'succeeded') {
        setStatus('success');
        const blob = await downloadDemoContract(token || '', {
          landlord: property.ownerId,
          tenant: user?.id || 'me',
          property: property.title,
          rent: property.price,
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        push({ title: 'Reserva realizada', tone: 'success' });
      }
    } catch {
      setStatus('error');
      push({ title: 'Error en el pago', tone: 'error' });
    }
  };

  if (loading) return (
    <div>
      <h1 className="page-title">Cargando propiedad…</h1>
      <div className="grid-detail">
        <div>
          <div className="gallery-empty" />
          <div className="card" style={{ marginTop: 12, height: 120 }} />
        </div>
        <div className="card" style={{ height: 280 }} />
      </div>
    </div>
  );
  if (loadError) return <div style={{ color: 'red' }}>{loadError}</div>;
  if (!property) return <div>Propiedad no encontrada</div>;
  const stripePkMissing = !process.env.REACT_APP_STRIPE_PK;
  return (
    <div>
      <h1 className="page-title">{property.title}</h1>
      <div className="grid-detail">
        <div>
          <Gallery photos={property.photos} />
          <Card style={{ padding: 16, marginTop: 12 }}>
            <p className="muted">{property.address}</p>
            <div className="price" style={{ fontSize: 20 }}>€{property.price}</div>
            {property.description && <p style={{ marginTop: 8 }}>{property.description}</p>}
          </Card>
        </div>
        <Card style={{ padding: 16 }}>
          <h3>Reserva</h3>
          {!token && (
            <Alert tone='info'>Inicia sesión para completar la reserva.</Alert>
          )}
          {stripePkMissing && (
            <Alert tone='warning'>Configura REACT_APP_STRIPE_PK para habilitar el pago en test.</Alert>
          )}
          <div id="card-element" style={{ border: '1px solid var(--border)', padding: '10px', borderRadius: 8, marginTop: 12 }}></div>
          <div style={{ marginTop: 12 }}>
            <Button onClick={handlePay} disabled={status === 'paying' || stripePkMissing || !token}>
              {status === 'paying' ? 'Pagando...' : status === 'success' ? 'Reservado' : 'Reservar'}
            </Button>
            {status === 'error' && <div style={{ color: 'red', marginTop: 8 }}>Error en el pago</div>}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PropertyDetail;
