import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { listContracts } from '../../api/contracts';
import Badge from '../../components/ui/Badge';

type ContractIncome = {
  id: string;
  title: string;
  rent: number;
  deposit: number;
  status?: string;
  lastPaidAt?: string;
  paymentRef?: string;
  depositPaid?: boolean;
  depositPaidAt?: string;
};

const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function LandlordPayments() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<ContractIncome[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token || !user) return;
      try {
        setLoading(true);
        setError(null);
        const response = await listContracts(token);
        const mine = (response.items || []).filter((c: any) => String(c.ownerId ?? c.landlord) === user._id);
        const mapped: ContractIncome[] = mine.map((c: any) => ({
          id: String(c._id || c.id),
          title: String(c.property || 'Contrato'),
          rent: Number(c.rent ?? c.rentAmount ?? 0),
          deposit: Number(c.deposit ?? 0),
          status: c.status,
          lastPaidAt: c.lastPaidAt,
          paymentRef: c.paymentRef,
          depositPaid: !!c.depositPaid,
          depositPaidAt: c.depositPaidAt,
        }));
        setItems(mapped);
      } catch (err: any) {
        const msg = err?.response?.data?.error || err?.message || 'No se pudieron cargar los pagos de tus contratos';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, user]);

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
    return <p>Inicia sesión para revisar los cobros de tus contratos.</p>;
  }

  if (loading) {
    return <p>Cargando cobros…</p>;
  }

  if (error) {
    return <p style={{ color: '#b91c1c' }}>{error}</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 style={{ marginBottom: 4 }}>Cobros y fianzas de mis inquilinos</h2>
        <p style={{ margin: 0, color: '#4b5563' }}>
          Consulta qué contratos han registrado pagos recientes y si la fianza ya está depositada en escrow o ante la administración.
        </p>
      </div>

      <section style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#6b7280' }}>Renta mensual agregada</span>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{currency.format(totals.rent)}</div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
          <span style={{ fontSize: 12, textTransform: 'uppercase', color: '#6b7280' }}>Depósitos vinculados</span>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{currency.format(totals.deposit)}</div>
        </div>
      </section>

      {items.length === 0 ? (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
          <strong>No hay contratos activos como propietario.</strong>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>
            Publica una propiedad y formaliza un contrato para empezar a ver aquí el detalle de cobros y retenciones.
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
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Último cobro</div>
                  <div style={{ fontWeight: 600 }}>{formatDate(item.lastPaidAt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Fianza</div>
                  <div style={{ fontWeight: 600 }}>
                    {item.depositPaid ? `Confirmada (${formatDate(item.depositPaidAt)})` : 'Pendiente de recaudar'}
                  </div>
                </div>
              </div>
              {item.paymentRef && (
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  Referencia de pago Stripe: <code>{item.paymentRef}</code>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
