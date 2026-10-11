import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { getContract, createSignSession, downloadPdf, downloadSignedPdf, payDeposit } from '../services/contracts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import SignaturitWidget from '../components/SignaturitWidget';
import CoTenantsCard from '../components/contracts/CoTenantsCard';
import ContractReceiptsCard from '../components/contracts/ContractReceiptsCard';
import { ContractStatusBadge } from '../components/ContractStatusBadge';
import { getContractActionSummary } from '../utils/contractWorkflow';
import type { PaymentDispute } from '../types/contract';
import { CheckCircle2, Circle, Clock3, Download, PenTool, Wallet } from 'lucide-react';

const secondaryButton =
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50';

function formatTimelineDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('es-ES');
}

const euros = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
    : '—';

function apiErrorMessage(error: any, fallback: string) {
  const message = error?.response?.data?.error;
  return typeof message === 'string' && message ? message : fallback;
}

// Mismos estados finales que el backend (`CLOSED_DISPUTE_STATUSES`).
const CLOSED_DISPUTE_STATUSES = ['won', 'lost', 'warning_closed'];

const DISPUTE_REASONS: Record<string, string> = {
  fraudulent: 'cargo no reconocido',
  unrecognized: 'cargo no reconocido',
  duplicate: 'cargo duplicado',
  product_not_received: 'servicio no recibido',
  subscription_canceled: 'servicio cancelado',
  credit_not_processed: 'devolución no recibida',
};

const monthLabel = (period: string) => {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month) return period;
  return new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
};

/** Disputas sin resolver de la fianza y de los recibos de renta, para el aviso del detalle. */
function openDisputes(contract: any) {
  const isOpen = (d?: PaymentDispute) => !!d?.id && !CLOSED_DISPUTE_STATUSES.includes(d.status);
  const items: Array<{ key: string; label: string; dispute: PaymentDispute }> = [];
  if (isOpen(contract?.depositDispute)) {
    items.push({ key: 'deposit', label: 'Fianza', dispute: contract.depositDispute });
  }
  for (const rent of Array.isArray(contract?.rentDisputes) ? contract.rentDisputes : []) {
    if (isOpen(rent)) items.push({ key: rent.period, label: `Renta de ${monthLabel(rent.period)}`, dispute: rent });
  }
  return items;
}

function buildContractTimeline(contract: any) {
  const status = contract?.status || 'draft';
  const completed = new Set(['signed', 'active', 'completed']);
  const generated = status !== 'draft';
  const signed = completed.has(status) || !!contract?.signedAt || !!contract?.signature?.signedAt;
  const depositPaid = !!contract?.depositPaid || status === 'active' || status === 'completed';
  const depositRefunded = !!contract?.depositRefundedAt;
  const depositPartlyRefunded = !depositRefunded && Number(contract?.depositAmountRefunded) > 0;

  return [
    {
      id: 'created',
      title: 'Contrato creado',
      detail: 'Borrador inicial generado',
      state: 'done',
      date: formatTimelineDate(contract?.createdAt),
    },
    {
      id: 'generated',
      title: 'PDF preparado',
      detail: 'Documento listo para revisar',
      state: generated ? 'done' : 'todo',
      date: formatTimelineDate(contract?.updatedAt),
    },
    {
      id: 'signature',
      title: 'Firma digital',
      detail: signed ? 'Firmas registradas' : 'Pendiente de firma',
      state: signed ? 'done' : status === 'pending_signature' || status === 'signing' ? 'current' : 'todo',
      date: formatTimelineDate(contract?.signedAt || contract?.signature?.signedAt),
    },
    {
      id: 'deposit',
      title: 'Pago de fianza',
      detail: depositRefunded
        ? 'Fianza devuelta'
        : depositPartlyRefunded
          ? `Pagada; devueltos ${euros(contract.depositAmountRefunded)}`
          : depositPaid
            ? 'Fianza pagada'
            : 'Pendiente de pago',
      state: depositPaid ? 'done' : signed ? 'current' : 'todo',
      date: formatTimelineDate(depositRefunded ? contract.depositRefundedAt : contract?.depositPaidAt),
    },
    {
      id: 'active',
      title: 'Contrato activo',
      detail: status === 'active' || status === 'completed' ? 'Alquiler en vigor' : 'Pendiente de activación',
      state: status === 'active' || status === 'completed' ? 'done' : 'todo',
      date: formatTimelineDate(contract?.startDate),
    },
  ] as Array<{ id: string; title: string; detail: string; state: 'done' | 'current' | 'todo'; date: string | null }>;
}

export default function ContractDetail() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const { push } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [payingDeposit, setPayingDeposit] = useState(false);
  // Vuelta desde Stripe Checkout: FRONTEND_URL/contracts/:id?deposit=success|cancel
  const [depositReturn] = useState(() => {
    const value = searchParams.get('deposit');
    return value === 'success' || value === 'cancel' ? value : null;
  });

  useEffect(() => {
    if (!searchParams.has('deposit')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('deposit');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadContract = useCallback(async () => {
    try {
      if (!id || !token) return;
      const data = await getContract(token, id);
      setContract(data);
    } catch (e) {
      console.error(e);
      push({ title: 'Error al cargar contrato', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [id, token, push]);

  useEffect(() => {
    loadContract();
  }, [loadContract]);

  const handleStartSigning = async () => {
    if (!contract) return;
    setIsSigning(true);
    try {
      const { signingUrl, provider } = await createSignSession(contract._id);
      if (!signingUrl) throw new Error('No se recibió URL de firma');
      // Firma.dev firma en su propia página y vuelve aquí al terminar (completion_redirect_url)
      if (provider === 'firma') {
        window.location.assign(signingUrl);
        return;
      }
      setSigningUrl(signingUrl);
    } catch (error) {
      console.error(error);
      push({ title: 'Error al iniciar firma segura', tone: 'error' });
      setIsSigning(false);
    }
  };

  const handlePayDeposit = async () => {
    if (!token || !contract?._id) return;
    setPayingDeposit(true);
    try {
      const { sessionUrl } = await payDeposit(token, contract._id);
      if (!sessionUrl) throw new Error('No se recibió la URL de pago');
      window.location.assign(sessionUrl);
    } catch (error) {
      push({ title: apiErrorMessage(error, 'No se pudo iniciar el pago de la fianza'), tone: 'error' });
      setPayingDeposit(false);
    }
  };

  const handleSignedSuccess = () => {
    setIsSigning(false);
    setSigningUrl(null);
    push({ title: '¡Documento firmado correctamente!', tone: 'success' });
    loadContract();
  };

  const handleDownloadDraft = async () => {
    if (!token || !contract?._id) return;
    try {
      const blob = await downloadPdf(token, contract._id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contrato_${contract._id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      push({ title: 'No se pudo descargar el contrato', tone: 'error' });
    }
  };

  const handleDownloadSigned = async () => {
    if (!token || !contract?._id) return;
    try {
      const blob = await downloadSignedPdf(token, contract._id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contrato_firmado_${contract._id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      push({ title: 'No se pudo descargar el contrato firmado', tone: 'error' });
    }
  };

  if (loading) return <div className="py-10 text-center text-sm text-gray-500">Cargando contrato…</div>;
  if (!contract) {
    return (
      <Card className="mx-auto max-w-xl px-5 py-6">
        <p className="font-medium text-gray-900">No encontramos este contrato</p>
        <p className="mt-1 text-sm text-gray-500">Puede que se haya cancelado o que no tengas acceso a él.</p>
        <Link to="/contracts" className={`${secondaryButton} mt-4`}>Volver a contratos</Link>
      </Card>
    );
  }

  const isTenant = user?.role === 'tenant';
  const myUserId = user?._id || (user as any)?.id;
  const contractTenantId =
    contract.tenantId || (typeof contract.tenant === 'object' ? contract.tenant?.id || contract.tenant?._id : contract.tenant);
  // Un co-titular también es «tenant», pero firma y paga desde su propia sección, no como inquilino principal.
  const isPrincipalTenant = isTenant && !!myUserId && String(contractTenantId) === String(myUserId);
  const needsMySignature = isPrincipalTenant && (contract.status === 'pending_signature' || contract.status === 'signing');
  const isActive = contract.status === 'active';
  const hasSignedPdf = !!contract?.signature?.pdfUrl;
  const downloadLabel = isActive || contract.status === 'signed' ? 'Descargar contrato' : 'Descargar borrador';
  const timeline = buildContractTimeline(contract);
  const actionSummary = getContractActionSummary(contract, user?.role);
  const rent = contract.rent ?? contract.rentAmount;
  const deposit = contract.deposit ?? contract.depositAmount;
  const property = typeof contract.property === 'object' ? contract.property : null;
  const address = property?.address || contract.propertyAddress || contract.address;
  const title = property?.title || address || 'Contrato de alquiler';
  const place = [address !== title ? address : '', property?.city || contract.city].filter(Boolean).join(', ');
  const signedAt = contract.signedAt || contract.signature?.signedAt;
  const isSigned = ['signed', 'active', 'completed'].includes(contract.status) || !!signedAt;
  const depositConfirming = depositReturn === 'success' && !contract.depositPaid;
  const canPayDeposit =
    isPrincipalTenant &&
    (contract.status === 'signed' || contract.status === 'active') &&
    !contract.depositPaid &&
    !depositConfirming;
  const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('es-ES') : '—');
  const disputes = openDisputes(contract);
  const depositRefundedAmount = Number(contract.depositAmountRefunded) > 0 ? Number(contract.depositAmountRefunded) : 0;
  const actionButton = 'inline-flex w-full items-center justify-center gap-2 whitespace-nowrap text-sm sm:w-auto';

  return (
    <div className="space-y-6 pb-10">
      {depositReturn === 'success' && (
        <div
          role="status"
          className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${
            contract.depositPaid ? 'border-emerald-200 bg-emerald-50' : 'border-[var(--border)] bg-[var(--card)]'
          }`}
        >
          <div>
            <p className="font-semibold text-gray-900">
              {contract.depositPaid ? 'Fianza pagada' : 'Pago de la fianza recibido'}
            </p>
            <p className="text-sm text-gray-600">
              {contract.depositPaid
                ? `Hemos registrado el pago de ${euros(deposit)}.`
                : 'Stripe está confirmando el cobro. La fianza aparecerá como pagada en unos instantes.'}
            </p>
          </div>
          {!contract.depositPaid && (
            <Button variant="secondary" size="sm" onClick={loadContract}>
              Actualizar estado
            </Button>
          )}
        </div>
      )}
      {depositReturn === 'cancel' && !contract.depositPaid && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-gray-900">Pago de la fianza cancelado</p>
          <p className="text-sm text-gray-600">No se ha hecho ningún cargo. Puedes volver a intentarlo cuando quieras.</p>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900 [overflow-wrap:anywhere]">{title}</h1>
            <ContractStatusBadge status={contract.status} />
          </div>
          {place && <p className="mt-1 text-sm text-gray-500">{place}</p>}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:shrink-0 lg:justify-end">
          {needsMySignature && (
            <Button onClick={handleStartSigning} className={actionButton}>
              <PenTool size={16} aria-hidden="true" /> Firmar contrato
            </Button>
          )}
          {canPayDeposit && (
            <Button
              onClick={handlePayDeposit}
              disabled={payingDeposit}
              className={actionButton}
              style={{ opacity: payingDeposit ? 0.7 : 1 }}
            >
              <Wallet size={16} aria-hidden="true" /> {payingDeposit ? 'Abriendo pago…' : `Pagar fianza · ${euros(deposit)}`}
            </Button>
          )}
          <Button variant="secondary" className={actionButton} onClick={handleDownloadDraft}>
            <Download size={16} aria-hidden="true" /> {downloadLabel}
          </Button>
          {hasSignedPdf && (
            <Button variant="secondary" className={actionButton} onClick={handleDownloadSigned}>
              <Download size={16} aria-hidden="true" /> Descargar firmado
            </Button>
          )}
        </div>
      </div>

      {disputes.length > 0 && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-gray-900">
            {disputes.length === 1 ? 'Hay una reclamación abierta sobre un cobro' : 'Hay reclamaciones abiertas sobre varios cobros'}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            El titular de la tarjeta ha pedido a su banco que devuelva el cargo. Stripe está revisando la reclamación;
            mientras tanto, el cobro sigue registrado.
          </p>
          <ul className="mt-2 space-y-1 text-sm text-gray-900">
            {disputes.map(({ key, label, dispute }) => {
              const reason = dispute.reason ? DISPUTE_REASONS[dispute.reason] : undefined;
              return (
                <li key={key}>
                  <span className="font-medium">{label}</span>
                  {typeof dispute.amount === 'number' && <span className="tabular-nums"> · {euros(dispute.amount)}</span>}
                  {reason && <span className="text-gray-600"> · {reason}</span>}
                  {dispute.openedAt && <span className="text-gray-600"> · desde el {formatDate(dispute.openedAt)}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Card className="px-5 py-4">
        <h2 className="text-sm font-medium text-gray-500">Siguiente paso</h2>
        <p className="mt-1 font-semibold text-gray-900">{actionSummary.nextAction}</p>
        <p className="mt-1 text-sm text-gray-600">{actionSummary.detail}</p>
        {actionSummary.blockedReason && (
          <p className="mt-2 text-sm text-amber-800">{actionSummary.blockedReason}.</p>
        )}
        {actionSummary.nextDate && (
          <p className="mt-2 text-sm text-gray-600">Próxima fecha clave: {actionSummary.nextDate}</p>
        )}
      </Card>

      <Card className="px-5 py-5">
        <h2 className="font-semibold text-gray-900">Estado del contrato</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-5 md:gap-3">
          {timeline.map((step) => {
            const isDone = step.state === 'done';
            const isCurrent = step.state === 'current';
            return (
              <li
                key={step.id}
                aria-current={isCurrent ? 'step' : undefined}
                className={`flex gap-3 border-l-2 pl-3 md:block md:border-l-0 md:border-t-2 md:pl-0 md:pt-3 ${
                  isDone ? 'border-emerald-600' : isCurrent ? 'border-gray-900' : 'border-gray-200'
                }`}
              >
                <span className="mt-0.5 shrink-0 md:mb-2 md:block">
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-label="Hecho" />
                  ) : isCurrent ? (
                    <Clock3 className="h-4 w-4 text-gray-900" aria-label="En curso" />
                  ) : (
                    <Circle className="h-4 w-4 text-gray-300" aria-label="Pendiente" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${isDone || isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>{step.title}</p>
                  <p className="mt-0.5 text-sm text-gray-500">{step.detail}</p>
                  {step.date && <p className="mt-0.5 text-xs tabular-nums text-gray-500">{step.date}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card className="px-5 py-4">
            <h2 className="font-semibold text-gray-900">Condiciones</h2>
            <dl className="mt-3 divide-y divide-gray-100 text-sm">
              {[
                { label: 'Renta mensual', value: euros(rent), strong: true },
                { label: 'Fianza', value: euros(deposit) },
                ...(depositRefundedAmount
                  ? [
                      {
                        label: contract.depositRefundedAt ? 'Fianza devuelta' : 'Fianza devuelta (parcial)',
                        value: contract.depositRefundedAt
                          ? `${euros(depositRefundedAmount)} · ${formatDate(contract.depositRefundedAt)}`
                          : euros(depositRefundedAmount),
                      },
                    ]
                  : []),
                { label: 'Inicio', value: formatDate(contract.startDate) },
                { label: 'Fin', value: formatDate(contract.endDate) },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 py-2">
                  <dt className="text-gray-500">{row.label}</dt>
                  <dd className={`tabular-nums text-gray-900 ${row.strong ? 'text-base font-semibold' : 'font-medium'}`}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {isSigned && token && <ContractReceiptsCard contractId={contract._id} token={token} />}

          <Card className="px-5 py-4">
            <h2 className="font-semibold text-gray-900">Partes</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Arrendador</dt>
                <dd className="font-medium text-gray-900">{contract.landlordName || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Arrendatario</dt>
                <dd className="font-medium text-gray-900">{contract.tenantName || '—'}</dd>
              </div>
            </dl>
          </Card>

          <CoTenantsCard
            contractId={contract._id}
            contractStatus={contract.status}
            myUserId={myUserId}
            canInvite={isPrincipalTenant}
            onSigned={loadContract}
          />
        </div>

        <section aria-labelledby="contract-preview-title" className="lg:col-span-2">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="contract-preview-title" className="font-semibold text-gray-900">Vista previa</h2>
            <p className="text-sm text-gray-500">
              {isSigned ? 'Resumen del contrato firmado. El documento completo está en el PDF.' : 'Borrador: puede cambiar hasta la firma. El texto completo está en el PDF.'}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-gray-50 p-3 sm:p-6">
            <article className="mx-auto max-w-2xl rounded-md border border-gray-200 bg-white p-5 text-sm leading-relaxed text-gray-800 sm:p-8">
              <h3 className="border-b border-gray-200 pb-4 text-center text-lg font-semibold text-gray-900">
                Contrato de arrendamiento de vivienda
              </h3>
              <p className="mt-6">En {property?.city || contract.city || '—'}, a {signedAt ? formatDate(signedAt) : new Date().toLocaleDateString('es-ES')}.</p>
              <h4 className="mt-6 font-semibold text-gray-900">Reunidos</h4>
              <p className="mt-1">
                De una parte, D./Dña. {contract.landlordName || '—'}, como arrendador.<br />
                De otra, D./Dña. {contract.tenantName || '—'}, como arrendatario.
              </p>
              <h4 className="mt-6 font-semibold text-gray-900">Acuerdan</h4>
              <p className="mt-1">
                El arrendamiento de la vivienda situada en {address || '—'}, con una renta mensual de {euros(rent)}, en estas condiciones:
              </p>
              <ol className="mt-3 list-decimal space-y-1 pl-5">
                <li>Duración: del {formatDate(contract.startDate)} al {formatDate(contract.endDate)}.</li>
                <li>Renta: {euros(rent)} al mes, pagaderos en los cinco primeros días.</li>
                <li>Fianza: {euros(deposit)}.</li>
                <li>Mascotas: {contract.petsAllowed ? 'permitidas' : 'no permitidas'}.</li>
              </ol>
              <div className="mt-10 grid grid-cols-1 gap-4 border-t border-gray-200 pt-6 sm:grid-cols-2">
                {[
                  { label: 'Arrendador', name: contract.landlordName },
                  { label: 'Arrendatario', name: contract.tenantName },
                ].map((party) => (
                  <div key={party.label}>
                    <p className="text-xs font-medium text-gray-500">{party.label}</p>
                    <div className="mt-1 rounded-md border border-dashed border-gray-300 px-3 py-3 text-xs">
                      {isSigned ? (
                        <>
                          <p className="font-medium text-gray-900">{party.name || 'Firmado'}</p>
                          <p className="text-gray-500">
                            Firmado electrónicamente{signedAt ? ` el ${formatDate(signedAt)}` : ''}
                          </p>
                        </>
                      ) : (
                        <p className="text-gray-500">Pendiente de firma electrónica</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </div>

      <Modal
        open={isSigning}
        onClose={() => setIsSigning(false)}
        title="Firma electrónica"
        className="max-w-6xl h-[85vh] w-full"
      >
        {signingUrl ? (
          <SignaturitWidget
            signingUrl={signingUrl}
            onSigned={handleSignedSuccess}
            onCancel={() => setIsSigning(false)}
            onError={() => push({ title: 'Error en el widget de firma', tone: 'error' })}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
            <p className="text-sm text-gray-500">Conectando con el proveedor de firma…</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
