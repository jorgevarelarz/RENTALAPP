import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getPaymentHistory, initiateRentPayment, listContracts } from '../../services/contracts';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import PaymentModal from '../../components/payments/PaymentModal';
import { useToast } from '../../context/ToastContext';
import { DollarSign, Calendar, Clock, CheckCircle2, History, AlertCircle } from 'lucide-react';

type PaymentHistoryItem = {
  _id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending';
  concept: string;
};

export default function Payments() {
  const { user, token } = useAuth();
  const { push } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeContract, setActiveContract] = useState<any>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [payData, setPayData] = useState<{ clientSecret: string; amount: number } | null>(null);

  useEffect(() => {
    const loadContract = async () => {
      if (!token) return;
      try {
        const res = await listContracts(token, { status: 'active', limit: 5 });
        const current = (res.items || []).find((c: any) => c.status === 'active' || c.status === 'signed');
        setActiveContract(current || null);
        if (current) {
          const payments = await getPaymentHistory(current._id);
          setHistory(
            payments.map(p => ({
              _id: p._id,
              date: p.paidAt || p.createdAt || new Date().toISOString(),
              amount: p.amount,
              status: p.status === 'succeeded' ? 'paid' : 'pending',
              concept: p.concept,
            })),
          );
        } else {
          setHistory([]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadContract();
  }, [token]);

  const handlePaymentSuccess = async () => {
    setShowPayModal(false);
    push({ title: '¡Renta pagada correctamente!', tone: 'success' });
    if (activeContract) {
      const payments = await getPaymentHistory(activeContract._id);
      setHistory(
        payments.map(p => ({
          _id: p._id,
          date: p.paidAt || p.createdAt || new Date().toISOString(),
          amount: p.amount,
          status: p.status === 'succeeded' ? 'paid' : 'pending',
          concept: p.concept,
        })),
      );
    }
  };

  const handlePayNow = async () => {
    if (!activeContract) return;
    try {
      const resp = await initiateRentPayment(activeContract._id);
      if (!resp.clientSecret) {
        throw new Error('No se pudo iniciar el pago');
      }
      setPayData({ clientSecret: resp.clientSecret, amount: resp.amount || activeContract.rentAmount || activeContract.rent || 0 });
      setShowPayModal(true);
    } catch (e: any) {
      push({ title: e?.message || 'No se pudo iniciar el pago', tone: 'error' });
    }
  };

  if (!token || !user) return <div className="p-6">Inicia sesión</div>;
  if (loading) return <div className="p-8 text-center">Cargando información de pagos...</div>;

  if (!activeContract) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Mis Pagos</h1>
        <Card className="text-center p-8">
          <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <DollarSign size={24} />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No tienes alquileres activos</h3>
          <p className="text-gray-500">Cuando firmes un contrato, aquí podrás gestionar tus mensualidades.</p>
        </Card>
      </div>
    );
  }

  const currentMonth = new Date().getMonth();
  const lastPaymentMonth = history[0] ? new Date(history[0].date).getMonth() : -1;
  const isPaidThisMonth = currentMonth === lastPaymentMonth;
  const rentAmount = activeContract.rentAmount || activeContract.rent || 0;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Renta</h1>
          <p className="text-gray-500 mt-1">
            Propiedad: <span className="font-medium text-gray-700">{activeContract.propertyAddress || 'Tu vivienda actual'}</span>
          </p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2">
          <Calendar size={16} />
          <span>Próximo vencimiento: 5 de {new Date().toLocaleString('es-ES', { month: 'long' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 p-6 bg-gradient-to-br from-white to-gray-50 border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Clock className="text-blue-600" /> Estado del Mes
          </h2>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-sm text-gray-500 uppercase font-bold tracking-wider mb-1">Total a Pagar</p>
              <p className="text-4xl font-extrabold text-gray-900">{rentAmount} €</p>
              <p className="text-sm text-gray-500 mt-1">Incluye gastos de comunidad</p>
            </div>

            {isPaidThisMonth ? (
              <div className="flex flex-col items-center bg-green-100 text-green-700 px-8 py-6 rounded-2xl border border-green-200">
                <CheckCircle2 size={48} className="mb-2" />
                <span className="font-bold text-xl">Pagado</span>
                <span className="text-xs opacity-80">Gracias por tu puntualidad</span>
              </div>
            ) : (
              <div className="w-full sm:w-auto">
                <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 px-4 py-2 rounded-lg mb-4 text-sm border border-yellow-100">
                  <AlertCircle size={16} />
                  <span>Pendiente de pago</span>
                </div>
                <Button
                  onClick={handlePayNow}
                  className="w-full sm:w-auto py-3 px-8 text-lg shadow-lg hover:shadow-xl bg-blue-600 hover:bg-blue-700 text-white transform hover:-translate-y-0.5 transition-all"
                >
                  Pagar Ahora
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="font-bold text-gray-900 border-b pb-2">Datos del Contrato</h3>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Inicio</span>
            <span className="font-medium">{new Date(activeContract.startDate).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Fin</span>
            <span className="font-medium">{new Date(activeContract.endDate).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Fianza</span>
            <span className="font-medium">{activeContract.deposit || activeContract.depositAmount} €</span>
          </div>
          <div className="mt-4 pt-4 border-t text-center">
            <a href={`/contracts/${activeContract._id}`} className="text-blue-600 text-sm font-medium hover:underline">
              Ver contrato firmado
            </a>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
          <History className="text-gray-500" size={18} />
          <h3 className="font-bold text-gray-700">Historial de Transacciones</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3">Concepto</th>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3">Método</th>
                <th className="px-6 py-3 text-right">Importe</th>
                <th className="px-6 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((item) => (
                <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{item.concept}</td>
                  <td className="px-6 py-4 text-gray-500">{new Date(item.date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-gray-500">
                    <span className="bg-gray-200 text-xs px-1.5 py-0.5 rounded text-gray-600">Tarjeta</span>
                  </td>
                  <td className="px-6 py-4 text-right font-bold">{item.amount} €</td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                      {item.status === 'paid' ? 'Completado' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showPayModal && activeContract && payData && (
        <PaymentModal
          open={showPayModal}
          onClose={() => setShowPayModal(false)}
          amountEUR={payData.amount || rentAmount}
          title={`Pagar Renta - ${new Date().toLocaleString('es-ES', { month: 'long' })}`}
          description={`Pago mensual del alquiler para: ${activeContract.propertyAddress || ''}`}
          onSuccess={handlePaymentSuccess}
          clientSecret={payData.clientSecret}
        />
      )}
    </div>
  );
}
