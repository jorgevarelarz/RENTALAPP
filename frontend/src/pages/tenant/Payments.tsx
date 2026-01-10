import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getPayments, payReceipt } from '../../services/payments';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import PaymentModal from '../../components/payments/PaymentModal';
import { useToast } from '../../context/ToastContext';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';

type PaymentItem = {
  _id: string;
  amount: number;
  currency?: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
  concept?: string;
  dueDate?: string;
  billingMonth?: number;
  billingYear?: number;
};

export default function Payments() {
  const { user, token } = useAuth();
  const { push } = useToast();

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payData, setPayData] = useState<{ clientSecret: string; amount: number } | null>(null);

  const loadPayments = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const items = await getPayments(token);
      setPayments(items);
    } catch (e: any) {
      push({ title: e?.message || 'No se pudieron cargar los pagos', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [token]);

  const handlePaymentSuccess = async () => {
    setShowPayModal(false);
    push({ title: 'Pago completado correctamente', tone: 'success' });
    await loadPayments();
  };

  const handlePayNow = async (paymentId: string) => {
    if (!token) return;
    try {
      const resp = await payReceipt(token, paymentId);
      if (!resp.clientSecret) {
        throw new Error('No se pudo iniciar el pago');
      }
      setPayData({ clientSecret: resp.clientSecret, amount: resp.amount || 0 });
      setShowPayModal(true);
    } catch (e: any) {
      push({ title: e?.message || 'No se pudo iniciar el pago', tone: 'error' });
    }
  };

  if (!token || !user) return <div className="p-6">Inicia sesión</div>;
  if (loading) return <div className="p-8 text-center"><Spinner /></div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Pagos y recibos"
        subtitle="Revisa recibos pendientes y pagos completados."
      />

      <div className="grid gap-4">
        {payments.length === 0 ? (
          <EmptyState
            title="Todo al dia"
            detail="No hay pagos pendientes en este momento."
          />
        ) : (
          payments.map((payment) => {
            const dueLabel = payment.dueDate
              ? new Date(payment.dueDate).toLocaleDateString('es-ES')
              : null;
            return (
              <Card key={payment._id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="font-bold text-gray-900">{payment.concept || 'Recibo de renta'}</p>
                  {dueLabel && (
                    <p className="text-sm text-gray-500">Vence: {dueLabel}</p>
                  )}
                  <p className="text-xs text-gray-400">ID: {payment._id}</p>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-lg">{payment.amount} €</span>
                  {payment.status === 'succeeded' ? (
                    <StatusBadge status="succeeded" label="Pagado" />
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handlePayNow(payment._id)}
                    >
                      Pagar ahora
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {showPayModal && payData && (
        <PaymentModal
          open={showPayModal}
          onClose={() => setShowPayModal(false)}
          amountEUR={payData.amount}
          title="Pagar renta"
          onSuccess={handlePaymentSuccess}
          clientSecret={payData.clientSecret}
        />
      )}
    </div>
  );
}
