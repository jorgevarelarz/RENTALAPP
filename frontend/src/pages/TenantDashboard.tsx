import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ActiveContractWidget } from '../components/dashboard/ActiveContractWidget';
import Button from '../components/ui/Button';

const TenantDashboard: React.FC = () => {
  const { user } = useAuth();
  const displayName = user?.email?.split('@')[0] || 'Inquilino';

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hola, {displayName}</h1>
          <p className="text-gray-500 mt-1">Aqui tienes un resumen de tu situacion actual.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/properties">
            <Button variant="secondary">Buscar casa</Button>
          </Link>
          <Link to="/profile">
            <Button variant="primary">Mi perfil</Button>
          </Link>
        </div>
      </div>

      <section>
        <ActiveContractWidget />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Mensajes</h3>
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Nuevo</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Contacta con tu casero o con soporte tecnico.
          </p>
          <Link to="/inbox" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            Ir a la bandeja de entrada &rarr;
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Historial de pagos</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Descarga tus recibos y facturas antiguas.
          </p>
          <Link to="/tenant/payments" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            Ver historial &rarr;
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Incidencias</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Algo roto en casa? Abre un ticket aqui.
          </p>
          <Link to="/tickets" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            Reportar problema &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TenantDashboard;
