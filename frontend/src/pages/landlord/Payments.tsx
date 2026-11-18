import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePolicyAcceptance } from '../../hooks/usePolicyAcceptance';
import { getPayments } from '../../services/payments';
import { paymentTitle, saveReceiptPdf } from '../../utils/payments';
import { apiErrorText } from '../../utils/apiErrors';
import PolicyModal from '../../components/PolicyModal';
import PayoutAccountCard from '../../components/payments/PayoutAccountCard';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import ErrorCard from '../../components/ui/ErrorCard';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';

type PaymentItem = {
  _id: string;
  amount: number;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
  type?: 'rent' | 'deposit' | 'service' | 'settlement';
  concept?: string;
  payee?: string;
  dueDate?: string;
  paidAt?: string;
  createdAt?: string;
  billingMonth?: number;
  billingYear?: number;
};

const POLICIES = ['terms_of_service', 'data_processing'] as const;

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const shortDate = (value?: string) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};
const hasReceipt = (p: PaymentItem) => p.status === 'succeeded' && (p.type === 'rent' || p.type === 'deposit');

/** Lo que el propietario espera cobrar va primero; después, lo cobrado, de más reciente a más antiguo. */
export function sortForLandlord<T extends Pick<PaymentItem, 'status' | 'paidAt' | 'createdAt'>>(items: T[]) {
  const open = (p: T) => p.status !== 'succeeded' && p.status !== 'refunded';
  const when = (p: T) => new Date(p.paidAt || p.createdAt || 0).getTime() || 0;
  return [...items].sort((a, b) => Number(open(b)) - Number(open(a)) || when(b) - when(a));
}

export default function LandlordPayments() {
  const { user, token } = useAuth();
  const { push } = useToast();
  const userId = String((user as any)?._id || (user as any)?.id || '');
  const policyTypes = useMemo(() => [...POLICIES], []);
  const { needsAcceptance, pendingPolicy, acceptPolicy } = usePolicyAcceptance(undefined, policyTypes);

  const [showPolicies, setShowPolicies] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const all = (await getPayments(token)) as PaymentItem[];
      // El mismo listado trae lo que el usuario paga y lo que cobra: aquí solo lo que cobra.
      setPayments(all.filter((p) => String(p.payee || '') === userId));
    } catch (err) {
      setError(apiErrorText(err, 'No se pudieron cargar tus cobros. Vuelve a intentarlo en un momento.'));
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    if (!needsAcceptance) void load();
  }, [load, needsAcceptance]);

  const download = async (payment: PaymentItem) => {
    if (!token) return;
    setBusyId(payment._id);
    try {
      await saveReceiptPdf(token, payment);
    } catch {
      push({ title: 'No se pudo descargar el recibo.', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const accept = async () => {
    await acceptPolicy();
    setShowPolicies(false);
  };

  const sorted = sortForLandlord(payments);
  const collected = payments.filter((p) => p.status === 'succeeded').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Cobros"
        subtitle="Tu cuenta bancaria para cobrar y cada renta o fianza que pagan tus inquilinos."
        cta={
          <Link to="/earnings" className="ra-btn ra-btn-secondary">
            Ver ingresos por mes
          </Link>
        }
      />

      {needsAcceptance && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6" aria-labelledby="policies-title">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="policies-title" className="font-['Manrope'] text-lg font-bold text-[var(--ra-ink)]">
                Acepta las condiciones para ver tus cobros
              </h2>
              <p className="mt-1 text-sm text-gray-800">
                Han cambiado los términos del servicio o el tratamiento de datos. Léelos y acéptalos para seguir.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => setShowPolicies(true)}>Leer condiciones</Button>
              <Button onClick={accept}>Aceptar y continuar</Button>
            </div>
          </div>
        </section>
      )}

      <PolicyModal
        isOpen={showPolicies}
        onClose={() => setShowPolicies(false)}
        policyTypes={policyTypes}
        pendingType={pendingPolicy?.policyType}
      />

      <PayoutAccountCard audience="landlord" />

      {!needsAcceptance && (
        <section aria-labelledby="history-title" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="history-title" className="font-['Manrope'] text-lg font-bold text-[var(--ra-ink)]">Cobros y recibos</h2>
            {collected > 0 && (
              <p className="text-sm text-[var(--ra-muted)]">
                Cobrado en total: <span className="font-semibold tabular-nums text-[var(--ra-ink)]">{euro.format(collected)}</span>
              </p>
            )}
          </div>

          {error ? (
            <ErrorCard message={error} onRetry={() => void load()} />
          ) : (
            <Card className="overflow-hidden">
              {loading ? (
                <div className="px-5 py-6 text-sm text-gray-500" aria-busy="true">Cargando cobros…</div>
              ) : sorted.length === 0 ? (
                <div className="px-5 py-6">
                  <p className="font-medium text-gray-900">Todavía no has cobrado nada por RentalApp</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Cuando un inquilino pague la fianza o una renta, aquí verás el cobro y podrás descargar su recibo.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {sorted.map((payment) => {
                    const title = paymentTitle(payment);
                    const paid = shortDate(payment.paidAt);
                    const due = shortDate(payment.dueDate);
                    return (
                      <li key={payment._id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">{title}</p>
                          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                            <span className="tabular-nums">{euro.format(Number(payment.amount) || 0)}</span>
                            {payment.status === 'succeeded' && paid && <span>Cobrado el {paid}</span>}
                            {(payment.status === 'pending' || payment.status === 'failed') && due && <span>Vence el {due}</span>}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <StatusBadge status={payment.status} label={payment.status === 'succeeded' ? 'Cobrado' : undefined} />
                          {hasReceipt(payment) && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busyId === payment._id}
                              aria-label={`Descargar recibo: ${title}`}
                              onClick={() => download(payment)}
                            >
                              Descargar recibo
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
