import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/ui/Card';
import { Search, ShieldCheck, FileSignature, CreditCard } from 'lucide-react';
import OnboardingChecklist from '../../components/OnboardingChecklist';

export default function TenantHome() {
  const { user } = useAuth();
  const firstName =
    (user as any)?.name?.split?.(' ')?.[0] ||
    user?.email?.split?.('@')?.[0] ||
    'Inquilino';

  return (
    <div className="space-y-8">
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Hola, {firstName} 👋
        </h1>
        <p className="text-gray-600 mt-2 text-lg">
          ¿En qué podemos ayudarte hoy? Gestiona tu hogar desde aquí.
        </p>
      </div>

      <OnboardingChecklist role="tenant" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/properties" className="block group">
          <Card
            style={{ height: '100%', padding: '24px', transition: 'all 0.2s', borderColor: 'transparent' }}
            className="hover:shadow-lg hover:border-blue-200 border bg-white"
          >
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-600 transition-colors">
              <Search className="text-blue-600 group-hover:text-white" size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2">Buscar nuevo hogar</h3>
            <p className="text-sm text-gray-500">Explora propiedades verificadas y filtra por tus preferencias.</p>
          </Card>
        </Link>

        <Link to="/tenant-pro" className="block group">
          <Card
            style={{ height: '100%', padding: '24px', transition: 'all 0.2s', borderColor: 'transparent' }}
            className="hover:shadow-lg hover:border-emerald-200 border bg-white"
          >
            <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-emerald-600 transition-colors">
              <ShieldCheck className="text-emerald-600 group-hover:text-white" size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2">Perfil Tenant PRO</h3>
            <p className="text-sm text-gray-500">
              {user?.tenantPro?.status === 'verified'
                ? '¡Tu perfil está verificado! Tienes prioridad.'
                : 'Verifica tu identidad y destaca ante los propietarios.'}
            </p>
          </Card>
        </Link>

        <Link to="/contracts" className="block group">
          <Card
            style={{ height: '100%', padding: '24px', transition: 'all 0.2s', borderColor: 'transparent' }}
            className="hover:shadow-lg hover:border-purple-200 border bg-white"
          >
            <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-600 transition-colors">
              <FileSignature className="text-purple-600 group-hover:text-white" size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2">Mis Contratos</h3>
            <p className="text-sm text-gray-500">Accede a tus contratos de alquiler firmados y documentos.</p>
          </Card>
        </Link>

        <Link to="/tenant/payments" className="block group">
          <Card
            style={{ height: '100%', padding: '24px', transition: 'all 0.2s', borderColor: 'transparent' }}
            className="hover:shadow-lg hover:border-orange-200 border bg-white"
          >
            <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-orange-600 transition-colors">
              <CreditCard className="text-orange-600 group-hover:text-white" size={24} />
            </div>
            <h3 className="font-bold text-lg mb-2">Pagos y Recibos</h3>
            <p className="text-sm text-gray-500">Consulta tu historial de pagos o configura el pago automático.</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
