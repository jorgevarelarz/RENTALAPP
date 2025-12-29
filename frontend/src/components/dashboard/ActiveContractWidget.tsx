import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listContracts } from '../../services/contracts';
import { useAuth } from '../../context/AuthContext';
import { Contract } from '../../types/contract';
import { ContractStatusBadge } from '../ContractStatusBadge';
import Card from '../ui/Card';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';

const pickActiveContract = (contracts: Contract[]) => {
  return (
    contracts.find((c) => c.status === 'active') ||
    contracts.find((c) => c.status === 'signed') ||
    contracts.find((c) => c.status === 'signing') ||
    null
  );
};

export const ActiveContractWidget: React.FC = () => {
  const { token, user } = useAuth();
  const [activeContract, setActiveContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!token || !user) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await listContracts(token);
        const items = (res.items || []) as Contract[];
        const hasIds = items.some((c: Contract) => c.tenantId || c.ownerId);
        const mine = hasIds
          ? items.filter(
              (c: Contract) => String(c.tenantId) === user._id || String(c.ownerId) === user._id
            )
          : items;
        setActiveContract(pickActiveContract(mine));
      } catch (e: any) {
        setError(e?.message || 'Error cargando contratos');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [token, user]);

  if (!token || !user) {
    return (
      <Card className="p-6">
        <p>Inicia sesion para ver tu contrato activo.</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-red-600">{error}</p>
      </Card>
    );
  }

  if (!activeContract) {
    return (
      <Card
        className="p-8 border-2 border-dashed border-indigo-200"
        style={{ background: 'linear-gradient(90deg, #eef2ff, #eff6ff)' }}
      >
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-indigo-400 mb-3" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-12 h-12"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">Aun no tienes hogar</h3>
          <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
            Explora nuestras propiedades verificadas y encuentra tu proximo alquiler sin papeleo.
          </p>
          <div className="mt-5">
            <Link to="/properties">
              <Button variant="primary">Explorar propiedades</Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  const contractId = activeContract._id || activeContract.id;
  const property =
    activeContract.property && typeof activeContract.property === 'object'
      ? activeContract.property
      : undefined;
  const title = property?.title || 'Contrato de alquiler';
  const address =
    activeContract.propertyAddress ||
    activeContract.address ||
    property?.address ||
    'Direccion no disponible';
  const owner =
    activeContract.landlordName ||
    (activeContract.landlord && typeof activeContract.landlord === 'object'
      ? activeContract.landlord.name
      : undefined) ||
    'Propietario no disponible';
  const rent = activeContract.rent;
  const monthLabel = new Date().toLocaleString('es-ES', { month: 'long' });
  const startDate = activeContract.signedAt || activeContract.startDate;
  const endDate = activeContract.endDate;
  const formatDate = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('es-ES');
  };
  const startLabel = formatDate(startDate);
  const endLabel = formatDate(endDate);

  return (
    <Card className="overflow-hidden border border-gray-200 shadow-md bg-white">
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {activeContract.status === 'active' ? 'Tu vivienda actual' : 'Proceso de alquiler'}
        </span>
        <ContractStatusBadge status={activeContract.status || 'draft'} />
      </div>

      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 aspect-video bg-gray-200 rounded-lg overflow-hidden relative">
            {property?.images?.[0] ? (
              <img
                src={property.images[0]}
                alt="Propiedad"
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <span className="text-sm font-semibold">Casa</span>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 leading-tight">{title}</h3>
              <p className="text-gray-600 flex items-center mt-1">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {address}
              </p>
              <p className="text-sm text-gray-500 mt-1">Propietario: {owner}</p>
              {(startLabel || endLabel) && (
                <p className="text-sm text-gray-500 mt-1">
                  Vigencia: {startLabel || '-'} a {endLabel || '-'}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-b border-gray-100 py-3">
              <div>
                <p className="text-sm text-gray-500">Alquiler mensual</p>
                <p className="text-lg font-semibold text-gray-900">{rent ? `${rent} EUR` : '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Proximo pago</p>
                <p className="text-lg font-semibold text-gray-900">5 {monthLabel}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              {contractId && (
                <Link to={`/contracts/${contractId}`} className="flex-1">
                  <Button variant="outline" className="w-full">
                    Ver contrato
                  </Button>
                </Link>
              )}
              {activeContract.status === 'active' && (
                <Link to="/tenant/payments" className="flex-1">
                  <Button variant="primary" className="w-full">
                    Pagar renta
                  </Button>
                </Link>
              )}
              {activeContract.status === 'signed' && !activeContract.depositPaid && contractId && (
                <Link to={`/contracts/${contractId}`} className="flex-1">
                  <Button variant="primary" className="w-full" style={{ background: '#16a34a' }}>
                    Pagar fianza
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
