import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getPayments, payReceipt } from '../../services/payments';
import { paymentTitle, saveReceiptPdf } from '../../utils/payments';
import Card from '../../components/ui/Card';
import PaymentModal from '../../components/payments/PaymentModal';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';

type PaymentItem = {
  _id: string;
  amount: number;
  currency?: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
  type?: 'rent' | 'deposit' | 'service' | 'settlement';
  concept?: string;
  payer?: string;
  dueDate?: string;
  paidAt?: string;
  billingMonth?: number;
  billingYear?: number;
};

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const shortDate = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

const isOpen = (p: PaymentItem) => p.status === 'pending' || p.status === 'failed';
const hasReceipt = (p: PaymentItem) => p.status === 'succeeded' && (p.type === 'rent' || p.type === 'deposit');

const primaryButton =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60';
const secondaryButton =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60';

export default function Payments() {
  const { user, token } = useAuth();
  const { push } = useToast();
  const userId = String((user as any)?._id || (user as any)?.id || '');

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payData, setPayData] = useState<{ clientSecret: string; amount: number } | null>(null);

  const loadPayments = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setFailed(false);
      setPayments(await getPayments(token));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handlePayNow = async (paymentId: string) => {
    if (!token) return;
    setBusyId(paymentId);
    try {
      const resp = await payReceipt(token, paymentId);
      if (!resp.clientSecret) throw new Error('missing_client_secret');
      setPayData({ clientSecret: resp.clientSecret, amount: resp.amount || 0 });
    } catch {
      push({ title: 'No se pudo iniciar el pago. Vuelve a intentarlo en un momento.', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (payment: PaymentItem) => {
    if (!token) return;
    setBusyId(payment._id);
    try {
      await saveReceiptPdf(token, payment);
    } catch {
      push({ title: 'No se pudo descargar el recibo', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const handlePaymentSuccess = async () => {
    setPayData(null);
    push({ title: 'Pago completado. El recibo estará disponible en unos segundos.', tone: 'success' });
    await loadPayments();
  };

  if (!token || !user) return <div className="p-6">Inicia sesión</div>;

  // Lo que hay que pagar va primero; el resto, en el orden del servidor (más reciente antes).
  const sorted = [...payments].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)));

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Pagos y recibos"
        subtitle="Lo que tienes pendiente y el recibo de cada pago, para descargar cuando lo necesites."
      />

      <Card className="overflow-hidden">
        {loading ? (
          <div className="px-5 py-6 text-sm text-gray-500">Cargando pagos…</div>
        ) : failed ? (
          <div className="px-5 py-6 text-sm text-red-700">No se pudieron cargar los pagos. Vuelve a intentarlo en un momento.</div>
        ) : sorted.length === 0 ? (
          <div className="px-5 py-6">
            <p className="font-medium text-gray-900">Todavía no hay pagos</p>
            <p className="mt-1 text-sm text-gray-500">Cuando pagues la fianza o la renta, aquí tendrás cada recibo.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sorted.map(payment => {
              const paid = shortDate(payment.paidAt);
              const due = shortDate(payment.dueDate);
              const canPay = isOpen(payment) && (!payment.payer || String(payment.payer) === userId);
              const title = paymentTitle(payment);
              return (
                <li
                  key={payment._id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{title}</p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span className="tabular-nums">{euro.format(Number(payment.amount) || 0)}</span>
                      {payment.status === 'succeeded' && paid && <span>Pagado el {paid}</span>}
                      {isOpen(payment) && due && <span>Vence el {due}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={payment.status} />
                    {canPay && (
                      <button
                        type="button"
                        className={primaryButton}
                        disabled={busyId === payment._id}
                        onClick={() => handlePayNow(payment._id)}
                      >
                        Pagar ahora
                      </button>
                    )}
                    {hasReceipt(payment) && (
                      <button
                        type="button"
                        className={secondaryButton}
                        disabled={busyId === payment._id}
                        aria-label={`Descargar recibo: ${title}`}
                        onClick={() => handleDownload(payment)}
                      >
                        Descargar recibo
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {payData && (
        <PaymentModal
          open
          onClose={() => setPayData(null)}
          amountEUR={payData.amount}
          title="Pagar renta"
          onSuccess={handlePaymentSuccess}
          clientSecret={payData.clientSecret}
        />
      )}
    </div>
  );
}
