import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { usePolicyAcceptance } from '../../hooks/usePolicyAcceptance';
import PolicyModal from '../../components/PolicyModal';
import client from '../../api/client';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PK || '');

const PaymentMethodForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setMsg('');
    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
    });
    if (error) setMsg(error.message || 'Error');
    else setMsg('Método guardado correctamente');
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="border p-4 rounded bg-white max-w-md">
      <h3 className="font-bold mb-4">Añadir nueva tarjeta o domiciliación</h3>
      <PaymentElement />
      <button
        disabled={!stripe || loading}
        className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Guardando...' : 'Guardar Método de Pago'}
      </button>
      {msg && <div className="text-sm mt-2">{msg}</div>}
    </form>
  );
};

const PaymentHistory = () => (
  <div className="bg-white p-6 rounded shadow-sm border text-center text-gray-500">
    <p>No tienes pagos recientes.</p>
  </div>
);

export default function TenantPayments() {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'methods'>('history');
  const [clientSecret, setClientSecret] = useState('');
  const { needsAcceptance, pendingPolicy, acceptPolicy } = usePolicyAcceptance(
    undefined,
    ['terms_of_service', 'data_processing'],
  );

  const handleAccept = async () => {
    await acceptPolicy();
    setShowModal(false);
  };

  useEffect(() => {
    if (activeTab === 'methods' && !clientSecret) {
      client
        .post('/payments/setup-intent')
        .then(res => setClientSecret(res.data.clientSecret))
        .catch(() => {});
    }
  }, [activeTab, clientSecret]);

  return (
    <div className="p-6" style={{ display: 'grid', gap: 12 }}>
      <h2 className="text-2xl font-bold mb-2">Mis Pagos</h2>
      <p className="text-gray-600">Gestiona tus pagos y métodos seguros.</p>
      {needsAcceptance && (
        <div style={{ padding: 12, border: '1px solid #f59e0b', borderRadius: 8, background: '#fffbeb' }}>
          <strong>Necesitas aceptar las políticas vigentes</strong>
          <p style={{ margin: '8px 0' }}>
            Falta aceptar: {pendingPolicy?.policyType ?? 'políticas obligatorias'}.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowModal(true)}>Ver políticas</button>
            <button onClick={handleAccept}>Aceptar y continuar</button>
          </div>
        </div>
      )}

      <PolicyModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        policyTypes={['terms_of_service', 'data_processing']}
        pendingType={pendingPolicy?.policyType}
      />

      <div className="flex border-b mb-4">
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 border-b-2 font-medium transition-colors ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Historial de Pagos
        </button>
        <button
          onClick={() => setActiveTab('methods')}
          className={`px-4 py-2 border-b-2 font-medium transition-colors ${
            activeTab === 'methods'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Mis Métodos de Pago
        </button>
      </div>

      {activeTab === 'history' && <PaymentHistory />}
      {activeTab === 'methods' && (
        <div>
          <p className="mb-4 text-gray-600">
            Gestiona tus tarjetas y cuentas para el pago automático del alquiler.
          </p>
          {clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentMethodForm />
            </Elements>
          ) : (
            <div className="text-gray-400">Cargando pasarela segura...</div>
          )}
        </div>
      )}
    </div>
  );
}
