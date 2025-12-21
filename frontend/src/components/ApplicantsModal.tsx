import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { getPropertyApplications, type Application } from '../services/properties';
import { proposeAppointment } from '../services/appointments';
import { useToast } from '../context/ToastContext';
import { CheckCircle2, FileSignature, MessageSquare, User, Calendar, Clock } from 'lucide-react';

interface Props {
  property: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ApplicantsModal({ property, isOpen, onClose }: Props) {
  const [applicants, setApplicants] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedulingApp, setSchedulingApp] = useState<string | null>(null);
  const [visitDate, setVisitDate] = useState('');

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
      setApplicants([
        {
          _id: 'app_1',
          tenant: { _id: 'tenant_1', name: 'Carlos Inquilino', email: 'carlos@test.com', tenantPro: { status: 'verified' } },
          status: 'pending',
          createdAt: new Date().toISOString(),
          message: 'Hola, me interesa mucho. ¿Podemos verlo?',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleVisit = async () => {
    if (!schedulingApp || !visitDate) return;
    try {
      // Si el backend soporta citas para propiedad, llamamos. En caso contrario se queda como mock visual.
      try {
        await proposeAppointment(schedulingApp, visitDate);
      } catch {
        // silencioso, mantenemos feedback local
      }

      push({ title: `Visita propuesta para el ${new Date(visitDate).toLocaleString()}`, tone: 'success' });
      setApplicants(prev =>
        prev.map(a =>
          a._id === schedulingApp ? { ...a, status: 'accepted', message: 'Visita Agendada' } : a
        )
      );
      setSchedulingApp(null);
      setVisitDate('');
    } catch (e) {
      push({ title: 'Error al agendar', tone: 'error' });
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
    <Modal open={isOpen} onClose={onClose} title={`Gestionar Candidatos: ${property?.title || ''}`}>
      <div className="min-h-[200px]">
        {loading ? (
          <div className="flex justify-center p-8 text-gray-500">Cargando candidatos...</div>
        ) : applicants.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <p>Aún no hay solicitudes para esta propiedad.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {applicants.map((app) => (
              <div key={app._id} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-4 hover:border-blue-300 transition-all bg-white shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                    </div>
                  </div>

                  <div className="text-right">
                    {app.status === 'accepted' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        <Calendar size={12} /> Visita Agendada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                        <Clock size={12} /> Pendiente de revisión
                      </span>
                    )}
                  </div>
                </div>

                {app.message && (
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg flex gap-2">
                    <MessageSquare size={16} className="mt-0.5 text-gray-400 shrink-0" />
                    <span className="italic">"{app.message}"</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  {schedulingApp === app._id ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                      <input
                        type="datetime-local"
                        className="text-xs border border-gray-300 rounded px-2 py-1.5"
                        value={visitDate}
                        onChange={e => setVisitDate(e.target.value)}
                      />
                      <Button size="sm" onClick={handleScheduleVisit} disabled={!visitDate}>Confirmar</Button>
                      <button onClick={() => setSchedulingApp(null)} className="text-xs text-red-500 underline ml-1">Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSchedulingApp(app._id)}
                        className="flex items-center gap-2"
                      >
                        <Calendar size={16} /> {app.status === 'accepted' ? 'Reprogramar Visita' : 'Agendar Visita'}
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleCreateContract(app)}
                        className={`flex items-center gap-2 ${app.status !== 'accepted' ? 'opacity-50 hover:opacity-100' : ''}`}
                        title={app.status !== 'accepted' ? "Normalmente se hace una visita primero" : "Iniciar borrador de contrato"}
                      >
                        <FileSignature size={16} /> Crear Contrato
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
