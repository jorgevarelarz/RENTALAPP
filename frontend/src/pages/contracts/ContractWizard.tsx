import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { createContract } from '../../services/contracts';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import {
  Calendar, DollarSign, Users, Scale, FileText,
  ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle
} from 'lucide-react';

const STEPS = [
  { id: 'terms', title: 'Términos', icon: <Calendar size={18} /> },
  { id: 'people', title: 'Intervinientes', icon: <Users size={18} /> },
  { id: 'clauses', title: 'Cláusulas', icon: <Scale size={18} /> },
  { id: 'review', title: 'Revisar', icon: <FileText size={18} /> },
];

export default function ContractWizard() {
  const { state } = useLocation();
  const { user } = useAuth();
  const nav = useNavigate();
  const { push } = useToast();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    propertyId: '',
    tenantId: '',
    startDate: '',
    endDate: '',
    durationYears: 1,
    rentAmount: 0,
    depositAmount: 0,
    paymentDay: 5,
    landlordName: (user as any)?.name || user?.email?.split?.('@')?.[0] || '',
    landlordIdDoc: '',
    tenantName: '',
    tenantIdDoc: '',
    tenantEmail: '',
    petsAllowed: false,
    expensesIncluded: false,
    sublettingAllowed: false,
    depositInAgency: true,
  });

  useEffect(() => {
    if (state) {
      setFormData(prev => ({
        ...prev,
        propertyId: (state as any).propertyId || '',
        tenantId: (state as any).tenantId || '',
        rentAmount: (state as any).initialData?.rentAmount || 0,
        depositAmount: (state as any).initialData?.depositAmount || 0,
        tenantName: (state as any).initialData?.tenantName || '',
        tenantEmail: (state as any).initialData?.tenantEmail || '',
        startDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 31536000000).toISOString().slice(0, 10),
        durationYears: 1,
      }));
    }
  }, [state]);

  useEffect(() => {
    if (!formData.startDate || !formData.durationYears) return;
    const start = new Date(formData.startDate);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + Number(formData.durationYears));
    const nextEnd = end.toISOString().slice(0, 10);
    if (nextEnd !== formData.endDate) {
      setFormData(prev => ({ ...prev, endDate: nextEnd }));
    }
  }, [formData.startDate, formData.durationYears, formData.endDate]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = () => {
    if (step === 0) {
      if (!formData.startDate || !formData.endDate) return "Las fechas son obligatorias.";
      if (formData.rentAmount <= 0) return "La renta debe ser mayor a 0.";
    }
    if (step === 1) {
      if (!formData.landlordIdDoc) return "Tu DNI/NIF es obligatorio para el contrato.";
      if (!formData.tenantName || !formData.tenantEmail) return "Faltan datos del inquilino.";
    }
    return null;
  };

  const handleNext = () => {
    const error = validateStep();
    if (error) {
      push({ title: error, tone: 'error' });
      return;
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await createContract(formData);
      push({ title: 'Contrato enviado a firma correctamente', tone: 'success' });
      nav('/landlord');
    } catch (e: any) {
      push({ title: e.message || 'Error al crear contrato', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Redactar Nuevo Contrato</h1>
        <p className="text-gray-500">Genera un contrato de arrendamiento legal en pocos pasos.</p>
        <div className="flex items-center justify-between mt-8 relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 rounded"></div>
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-col items-center gap-2 bg-white px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                i === step ? 'border-blue-600 bg-blue-50 text-blue-600' :
                i < step ? 'border-green-500 bg-green-500 text-white' : 'border-gray-200 text-gray-400'
              }`}>
                {i < step ? <CheckCircle2 size={20} /> : s.icon}
              </div>
              <span className={`text-xs font-medium ${i === step ? 'text-blue-600' : 'text-gray-500'}`}>{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      <Card className="min-h-[400px] flex flex-col">
        <div className="flex-1 p-2">
          {step === 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Condiciones Económicas y Duración</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Fecha de Inicio" type="date"
                  value={formData.startDate}
                  onChange={e => handleChange('startDate', e.target.value)}
                />
                <Input
                  label="Fecha de Fin" type="date"
                  value={formData.endDate}
                  readOnly
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Duracion del contrato (anos)
                  </span>
                  <select
                    className="auth-input"
                    value={formData.durationYears}
                    onChange={e => handleChange('durationYears', Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((years) => (
                      <option key={years} value={years}>{years} ano{years > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </label>
                <div className="text-sm text-gray-500 flex items-end">
                  Por defecto 1 ano, prorrogable hasta 5 anos.
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Renta Mensual (€)</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-3 text-gray-400"/>
                    <input
                      type="number"
                      className="auth-input pl-10 w-full"
                      value={formData.rentAmount}
                      onChange={e => handleChange('rentAmount', Number(e.target.value))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fianza (€)</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-3 text-gray-400"/>
                    <input
                      type="number"
                      className="auth-input pl-10 w-full"
                      value={formData.depositAmount}
                      onChange={e => handleChange('depositAmount', Number(e.target.value))}
                    />
                  </div>
                </div>
                <Input
                  label="Día límite de pago (mensual)" type="number" min={1} max={30}
                  value={formData.paymentDay}
                  onChange={e => handleChange('paymentDay', Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Datos de las Partes</h3>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2"><Users size={18}/> Arrendador (Propietario)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nombre Completo" value={formData.landlordName} onChange={e => handleChange('landlordName', e.target.value)} />
                  <Input label="DNI / NIF" placeholder="12345678X" value={formData.landlordIdDoc} onChange={e => handleChange('landlordIdDoc', e.target.value)} />
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2"><Users size={18}/> Arrendatario (Inquilino)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nombre Completo" value={formData.tenantName} onChange={e => handleChange('tenantName', e.target.value)} />
                  <Input label="Email (para firma)" value={formData.tenantEmail} disabled />
                </div>
                <div className="mt-4">
                  <Input label="DNI / NIF / Pasaporte del Inquilino" placeholder="Solicitar al inquilino si no lo tienes" value={formData.tenantIdDoc} onChange={e => handleChange('tenantIdDoc', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Cláusulas del Contrato</h3>
              <p className="text-sm text-gray-500">Define las reglas de convivencia y legales. Se añadirán al texto estándar.</p>
              <div className="grid grid-cols-1 gap-4">
                {[
                  { key: 'petsAllowed', label: 'Permitir Mascotas', desc: 'El inquilino puede tener animales domésticos en la vivienda.' },
                  { key: 'expensesIncluded', label: 'Gastos Incluidos', desc: 'La renta incluye gastos de suministros (Luz, Agua, Gas).' },
                  { key: 'sublettingAllowed', label: 'Permitir Subarriendo', desc: 'El inquilino puede subarrendar habitaciones.' },
                  { key: 'depositInAgency', label: 'Depositar fianza en organismo', desc: 'El propietario se compromete a depositar la fianza en la CCAA correspondiente.', disabled: true }
                ].map((item) => (
                  <label key={item.key} className={`flex items-start gap-4 p-4 border rounded-xl transition-all cursor-pointer ${
                    // @ts-ignore
                    formData[item.key] ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="checkbox"
                      className="mt-1 w-5 h-5 text-blue-600 rounded"
                      // @ts-ignore
                      checked={formData[item.key]}
                      // @ts-ignore
                      onChange={e => !item.disabled && handleChange(item.key, e.target.checked)}
                      // @ts-ignore
                      disabled={item.disabled}
                    />
                    <div>
                      <span className="block font-bold text-gray-900">{item.label}</span>
                      <span className="text-sm text-gray-500">{item.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="text-yellow-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-yellow-800">Borrador Listo</h4>
                  <p className="text-sm text-yellow-700">Revisa los datos. Al confirmar, se generará el documento legal y se enviará una notificación al inquilino para su firma digital.</p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Propiedad</span>
                  <span className="font-medium">{(state as any)?.initialData?.address || 'Dirección Propiedad'}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Duración</span>
                  <span className="font-medium">{formData.startDate} a {formData.endDate}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Renta Mensual</span>
                  <span className="font-bold text-lg">{formData.rentAmount} €</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Fianza</span>
                  <span className="font-medium">{formData.depositAmount} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mascotas</span>
                  <span className={`font-bold ${formData.petsAllowed ? 'text-green-600' : 'text-red-500'}`}>
                    {formData.petsAllowed ? 'PERMITIDAS' : 'PROHIBIDAS'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 mt-4 border-t border-gray-100 flex justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0 || loading}
            className="text-gray-500"
          >
            <ArrowLeft size={18} className="mr-2"/> Atrás
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext} className="px-6">
              Siguiente <ArrowRight size={18} className="ml-2"/>
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} className="px-8 bg-green-600 hover:bg-green-700 text-white shadow-lg">
              {loading ? 'Generando Contrato...' : 'Enviar a Firma Digital'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
