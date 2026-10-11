import React, { useEffect, useState } from 'react';
import Card from '../ui/Card';
import { useToast } from '../../context/ToastContext';
import { getPaymentHistory, type ContractPayment } from '../../services/contracts';
import { paymentTitle, saveReceiptPdf } from '../../utils/payments';

const VISIBLE = 6;

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const shortDate = (value?: string) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
};

const ACTION =
  'text-xs font-semibold text-[var(--ra-blue)] hover:underline disabled:cursor-default disabled:text-gray-400 disabled:no-underline';

type Props = {
  contractId: string;
  token: string;
};

/** Rentas y fianza cobradas del contrato, cada una con su recibo PDF (art. 17.4 LAU). */
export default function ContractReceiptsCard({ contractId, token }: Props) {
  const { push } = useToast();
  const [payments, setPayments] = useState<ContractPayment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const items = await getPaymentHistory(contractId);
        if (alive) setPayments(Array.isArray(items) ? items : []);
      } catch (error: any) {
        if (!alive) return;
        // Sin permiso (p. ej. co-titular aún invitado) no se enseña la tarjeta.
        if (error?.response?.status === 403) setPayments(null);
        else setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [contractId]);

  const handleDownload = async (payment: ContractPayment) => {
    setBusyId(payment._id);
    try {
      await saveReceiptPdf(token, payment);
    } catch {
      push({ title: 'No se pudo descargar el recibo', tone: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  if (!failed && payments === null) return null;

  const visible = payments && !showAll ? payments.slice(0, VISIBLE) : payments || [];
  const hidden = (payments?.length || 0) - visible.length;

  return (
    <Card className="px-5 py-4">
      <h2 className="font-semibold text-gray-900">Cobros y recibos</h2>
      {failed ? (
        <p className="mt-2 text-sm text-gray-500">No se pudieron cargar los cobros. Vuelve a intentarlo más tarde.</p>
      ) : visible.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Aún no hay cobros. Cada renta y la fianza tendrán aquí su recibo en PDF.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {visible.map((p) => {
              const title = paymentTitle(p);
              const refunded = Number(p.amountRefunded) > 0 ? Number(p.amountRefunded) : 0;
              return (
                <li key={p._id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{title}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {p.paidAt ? `Pagado el ${shortDate(p.paidAt)}` : 'Pagado'}
                      {refunded > 0 && ` · devueltos ${euro.format(refunded)}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium tabular-nums text-gray-900">{euro.format(Number(p.amount) || 0)}</p>
                    <button
                      type="button"
                      className={ACTION}
                      onClick={() => handleDownload(p)}
                      disabled={busyId === p._id}
                      aria-label={`Descargar recibo: ${title}`}
                    >
                      {busyId === p._id ? 'Descargando…' : 'Recibo PDF'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {hidden > 0 && (
            <button type="button" className={`${ACTION} mt-2`} onClick={() => setShowAll(true)}>
              Ver {hidden === 1 ? 'el cobro anterior' : `los ${hidden} cobros anteriores`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
