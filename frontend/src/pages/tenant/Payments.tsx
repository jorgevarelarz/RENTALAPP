import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { initiateContractPayment, listContracts, payDeposit } from '../../api/contracts';
import Badge from '../../components/ui/Badge';
import { useToast } from '../../context/ToastContext';
import StripePaymentDialog from '../../components/payments/StripePaymentDialog';

type ContractPayment = {
  id: string;
  title: string;
  rent: number;
  deposit: number;
  lastPaidAt?: string;
  status?: string;
  paymentRef?: string;
  depositPaid?: boolean;
  depositPaidAt?: string;
};

const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

const formatDate = (value?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function TenantPayments() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<ContractPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingRent, setProcessingRent] = useState<string | null>(null);
  const [processingDeposit, setProcessingDeposit] = useState<string | null>(null);
  const [activePayment, setActivePayment] = useState<{ contractId: string; clientSecret: string } | null>(null);
  const { push } = useToast();

  const loadContracts = useCallback(async () => {
    if (!token || !user) return;
    try {
      setLoading(true);
      setError(null);
      const response = await listContracts(token);
      const contracts = (response.items || []).filter((c: any) => String(c.tenantId ?? c.tenant) === user._id);
      const mapped: ContractPayment[] = contracts.map((c: any) => ({
        id: String(c._id || c.id),
        title: String(c.property || 'Contrato'),
        rent: Number(c.rent ?? c.rentAmount ?? 0),
        deposit: Number(c.deposit ?? 0),
        lastPaidAt: c.lastPaidAt,
        status: c.status,
        paymentRef: c.paymentRef,
        depositPaid: !!c.depositPaid,
        depositPaidAt: c.depositPaidAt,
      }));
      setItems(mapped);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'No se pudieron cargar los pagos';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    loadContracts();
  }, [loadContracts]);

  const handleRentPayment = async (contractId: string, amount: number) => {
    if (!token) return;
    try {
      setProcessingRent(contractId);
      const resp = await initiateContractPayment(token, contractId, amount);
      if (resp.clientSecret) {
        setActivePayment({ contractId, clientSecret: resp.clientSecret });
      } else {
        push({ title: resp.message || 'Pago iniciado', tone: 'success' });
        await loadContracts();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'No se pudo iniciar el pago de la renta';
      push({ title: msg, tone: 'error' });
    } finally {
      setProcessingRent(null);
    }
  };

  const handleDepositPayment = async (contractId: string) => {
    if (!token) return;
    try {
      setProcessingDeposit(contractId);
      const origin = window.location.origin;
      const resp = await payDeposit(token, contractId, {
        destination: 'escrow',
        successUrl: `${origin}/deposit/success`,
        cancelUrl: `${origin}/deposit/cancel`,
      });
      if (resp.sessionUrl) {
        window.open(resp.sessionUrl, '_blank', 'noopener');
        push({ title: 'Abre el enlace para completar el pago de la fianza', tone: 'info' });
      } else {
        push({ title: resp.message || 'Fianza registrada', tone: 'success' });
      }
      await loadContracts();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'No se pudo procesar la fianza';
      push({ title: msg, tone: 'error' });
    } finally {
      setProcessingDeposit(null);
    }
  };

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.rent += item.rent;
        acc.deposit += item.deposit;
        return acc;
      },
      { rent: 0, deposit: 0 },
    );
  }, [items]);

  if (!user || !token) {
    return <p>Inicia sesión para consultar tus pagos.</p>;
  }

  if (loading) {
    return <p>Cargando pagos...</p>;
  }

  if (error) {
    return <p style={{ color: '#b91c1c' }}>{error}</p>;
  }

  return (
    <>
      <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ marginBottom: 4 }}>Pagos de mis contratos</h2>
        <p style={{ margin: 0, color: '#4b5563' }}>
          Revisa la fecha del último cobro, el estado de la fianza y los importes vigentes en cada contrato activo.
        </p>
      </div>

      <section style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#6b7280' }}>Renta mensual agregada</span>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{currency.format(totals.rent)}</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#6b7280' }}>Depósitos asociados</span>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{currency.format(totals.deposit)}</div>
        </div>
      </section>

      {items.length === 0 ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          <strong>No se encontraron contratos como inquilino.</strong>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            Cuando firmes un contrato activo, verás aquí los cobros previstos y el historial de pagos.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map(item => (
            <article
              key={item.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 16,
                display: 'grid',
                gap: 8,
              }}
            >
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Contrato #{item.id.slice(-6)}</div>
                </div>
                <Badge tone="highlight">{item.status || 'sin estado'}</Badge>
              </header>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Renta mensual</div>
                  <div style={{ fontWeight: 600 }}>{currency.format(item.rent)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Depósito</div>
                  <div style={{ fontWeight: 600 }}>{currency.format(item.deposit)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Último pago de renta</div>
                  <div style={{ fontWeight: 600 }}>{formatDate(item.lastPaidAt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Fianza</div>
                  <div style={{ fontWeight: 600 }}>
                    {item.depositPaid ? `Pagada (${formatDate(item.depositPaidAt)})` : 'Pendiente'}
                  </div>
                </div>
              </div>
              {item.paymentRef && (
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Referencia de cobro Stripe: <code>{item.paymentRef}</code>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleRentPayment(item.id, item.rent)}
                  disabled={processingRent === item.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #111827',
                    background: processingRent === item.id ? '#e5e7eb' : '#111827',
                    color: processingRent === item.id ? '#111827' : '#fff',
                  }}
                >
                  {processingRent === item.id ? 'Generando intent…' : 'Pagar renta (Stripe)'}
                </button>
                {!item.depositPaid && (
                  <button
                    type="button"
                    onClick={() => handleDepositPayment(item.id)}
                    disabled={processingDeposit === item.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #2563eb',
                      background: processingDeposit === item.id ? '#e0f2fe' : '#2563eb',
                      color: '#fff',
                    }}
                  >
                    {processingDeposit === item.id ? 'Procesando…' : 'Pagar fianza'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
      <StripePaymentDialog
        clientSecret={activePayment?.clientSecret || null}
        open={!!activePayment}
        onClose={async (completed?: boolean) => {
          setActivePayment(null);
          if (completed) {
            push({ title: 'Pago confirmado correctamente', tone: 'success' });
            await loadContracts();
          }
        }}
      />
    </>
  );
}
