import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePolicyAcceptance } from '../../hooks/usePolicyAcceptance';
import PolicyModal from '../../components/PolicyModal';
import client from '../../api/client';

const PayoutSettings = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/connect/owner/status', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      setStatus(res.data);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'No se pudo cargar el estado.';
      alert(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus, location.search]);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { data } = await client.post('/api/connect/owner/link');
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Error conectando con Stripe';
      alert(message);
      setLoading(false);
    }
  };

  if (!status) return <div>Cargando estado...</div>;

  return (
    <div className="bg-white border rounded p-6 max-w-2xl">
      <h3 className="font-bold text-lg mb-2">Cuenta Bancaria para Cobros</h3>
      <p className="text-sm text-gray-600 mb-4">Gestionada de forma segura a través de Stripe.</p>

      <div className="flex items-center gap-3 mb-6">
        <div
          className={`h-3 w-3 rounded-full ${
            status.charges_enabled ? 'bg-green-500' : 'bg-yellow-500'
          }`}
        />
        <span className="font-medium">
          {status.charges_enabled ? 'Cuenta Activa y Verificada' : 'Acción Requerida / Verificación Pendiente'}
        </span>
      </div>
      <div className="text-sm text-gray-600 mb-4">
        <div>Conectada: {status.connected ? 'Si' : 'No'}</div>
        <div>Pagos habilitados: {status.charges_enabled ? 'Si' : 'No'}</div>
        <div>Retiros habilitados: {status.payouts_enabled ? 'Si' : 'No'}</div>
        {status.requirements?.current_deadline && (
          <div>Fecha limite: {new Date(status.requirements.current_deadline * 1000).toLocaleDateString()}</div>
        )}
      </div>

      <button
        onClick={handleConnect}
        disabled={loading}
        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
      >
        {status.connected ? 'Actualizar Datos Bancarios' : 'Conectar Cuenta Bancaria'}
      </button>
      <button
        onClick={loadStatus}
        disabled={loading}
        className="ml-3 border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? 'Actualizando...' : 'Actualizar estado'}
      </button>
    </div>
  );
};

const EarningsHistory = () => (
  <div className="bg-white border rounded p-6 text-center text-gray-500">
    <p>No hay cobros registrados este mes.</p>
  </div>
);

export default function LandlordPayments() {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'settings'>('history');
  const { needsAcceptance, pendingPolicy, acceptPolicy } = usePolicyAcceptance(
    undefined,
    ['terms_of_service', 'data_processing'],
  );

  const handleAccept = async () => {
    await acceptPolicy();
    setShowModal(false);
  };

  return (
    <div className="p-6" style={{ display: 'grid', gap: 12 }}>
      <h2 className="text-2xl font-bold mb-2">Gestión Financiera</h2>
      <p className="text-gray-600">Cobros y configuración de cuenta bancaria.</p>
      {needsAcceptance && (
        <div style={{ padding: 12, border: '1px solid #f59e0b', borderRadius: 8, background: '#fffbeb' }}>
          <strong>Debes aceptar las políticas vigentes</strong>
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
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Historial de Cobros
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 border-b-2 font-medium transition-colors ${
            activeTab === 'settings'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Mis Métodos de Cobro
        </button>
      </div>

      {activeTab === 'history' && <EarningsHistory />}
      {activeTab === 'settings' && <PayoutSettings />}
    </div>
  );
}
