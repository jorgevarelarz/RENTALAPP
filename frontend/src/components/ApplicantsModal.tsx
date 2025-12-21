import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { getPropertyApplications, type Application } from '../services/properties';
import { CheckCircle2, FileSignature, MessageSquare, User } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface Props {
  property: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ApplicantsModal({ property, isOpen, onClose }: Props) {
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  const { push } = useToast();

  useEffect(() => {
    if (isOpen && property?._id) {
      loadApplicants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, property?._id]);

  const loadApplicants = async () => {
    try {
      setLoading(true);
      const data = await getPropertyApplications(property._id);
      setApplicants(Array.isArray(data) ? data : data.items || []);
    } catch (e) {
      console.error(e);
      setApplicants([
        {
          _id: 'app_mock',
          tenant: { _id: 'tenant_mock', name: 'Candidato demo', email: 'demo@test.com', tenantPro: { status: 'verified' } },
          status: 'pending',
          createdAt: new Date().toISOString(),
          message: 'Hola, me interesa este piso. Ingresos estables.',
        },
      ]);
      push({ title: 'Mostrando datos de ejemplo (sin backend de solicitudes)', tone: 'info' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContract = (app: Application) => {
    onClose();
    nav('/contracts/new', {
      state: {
        propertyId: property._id,
        tenantId: app.tenant._id,
        initialData: {
          address: property.address,
          city: property.city,
          rentAmount: property.price,
          depositAmount: property.deposit,
          tenantName: app.tenant.name,
          tenantEmail: app.tenant.email,
        },
      },
    });
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={`Solicitudes para: ${property?.title || ''}`}>
      <div className="min-h-[220px]">
        {loading ? (
          <div className="flex justify-center p-8 text-gray-500">Cargando candidatos...</div>
        ) : applicants.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <p>Aún no hay solicitudes para esta propiedad.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {applicants.map((app) => (
              <div
                key={app._id}
                className="border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-300 transition-all bg-white shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 flex-shrink-0">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-900">{app.tenant.name}</h4>
                      {app.tenant.tenantPro?.status === 'verified' && (
                        <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <CheckCircle2 size={10} /> SOLVENTE
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{app.tenant.email}</p>
                    {app.message && (
                      <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded flex gap-2">
                        <MessageSquare size={14} className="mt-0.5 text-gray-400 shrink-0" />
                        <span className="italic">"{app.message}"</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleCreateContract(app)}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  >
                    <FileSignature size={16} /> Crear Contrato
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
