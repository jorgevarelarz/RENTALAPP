import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getContract, createSignSession, downloadPdf, downloadSignedPdf, payDeposit } from '../services/contracts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import SignaturitWidget from '../components/SignaturitWidget';
import { ContractStatusBadge } from '../components/ContractStatusBadge';
import { getContractActionSummary } from '../utils/contractWorkflow';
import { CheckCircle2, Circle, Clock3, FileCheck, User, ShieldCheck, Download, PenTool, Wallet } from 'lucide-react';

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

function buildContractTimeline(contract: any) {
  const status = contract?.status || 'draft';
  const completed = new Set(['signed', 'active', 'completed']);
  const generated = status !== 'draft';
  const signed = completed.has(status) || !!contract?.signedAt || !!contract?.signature?.signedAt;
  const depositPaid = !!contract?.depositPaid || status === 'active' || status === 'completed';

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
      detail: depositPaid ? 'Fianza marcada como pagada' : 'Pendiente de pago o conciliación',
      state: depositPaid ? 'done' : signed ? 'current' : 'todo',
      date: formatTimelineDate(contract?.depositPaidAt),
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

  if (loading) return <div className="p-8 text-center">Cargando contrato...</div>;
  if (!contract) return <div className="p-8 text-center text-red-500">Contrato no encontrado</div>;

  const isTenant = user?.role === 'tenant';
  const needsMySignature = isTenant && (contract.status === 'pending_signature' || contract.status === 'signing');
  const isActive = contract.status === 'active';
  const hasSignedPdf = !!contract?.signature?.pdfUrl;
  const downloadLabel = isActive || contract.status === 'signed' ? 'Descargar contrato' : 'Descargar borrador';
  const timeline = buildContractTimeline(contract);
  const actionSummary = getContractActionSummary(contract, user?.role);
  const rent = contract.rent ?? contract.rentAmount;
  const deposit = contract.deposit ?? contract.depositAmount;
  const property = typeof contract.property === 'object' ? contract.property : null;
  const address = property?.address || contract.propertyAddress || contract.address;
  const signedAt = contract.signedAt || contract.signature?.signedAt;
  const isSigned = ['signed', 'active', 'completed'].includes(contract.status) || !!signedAt;
  const depositConfirming = depositReturn === 'success' && !contract.depositPaid;
  const canPayDeposit =
    isTenant &&
    (contract.status === 'signed' || contract.status === 'active') &&
    !contract.depositPaid &&
    !depositConfirming;
  const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString('es-ES') : '—');

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      {depositReturn === 'success' && (
        <div
          role="status"
          className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            contract.depositPaid ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'
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
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-gray-900">Pago de la fianza cancelado</p>
          <p className="text-sm text-gray-600">No se ha hecho ningún cargo. Puedes volver a intentarlo cuando quieras.</p>
        </div>
      )}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
        isActive ? 'bg-green-50 border-green-200' : 'bg-indigo-50 border-indigo-200'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isActive ? 'bg-green-100 text-green-600' : 'bg-indigo-100 text-indigo-600'
          }`}>
            {isActive ? <ShieldCheck size={24} /> : <FileCheck size={24} />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {contract.status === 'pending_signature' || contract.status === 'signing'
                ? `Pendiente de firma · ${actionSummary.label}`
                : actionSummary.label}
            </h1>
            <p className="text-sm text-gray-600">
              ID Referencia: {contract._id?.slice(-6).toUpperCase()} · {actionSummary.detail}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-400 uppercase tracking-wide">Estado actual</span>
            <ContractStatusBadge
              status={contract.status}
              className="mt-1"
              style={{ fontSize: 12, padding: '4px 10px' }}
            />
          </div>
          <Button variant="secondary" className="flex items-center gap-2 whitespace-nowrap" onClick={handleDownloadDraft}>
            <Download size={16} /> {downloadLabel}
          </Button>
          {hasSignedPdf && (
            <Button variant="secondary" className="flex items-center gap-2 whitespace-nowrap" onClick={handleDownloadSigned}>
              <Download size={16} /> Descargar firmado
            </Button>
          )}
          {needsMySignature && (
            <Button
              onClick={handleStartSigning}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center gap-2 whitespace-nowrap"
            >
              <PenTool size={18} /> Firmar contrato
            </Button>
          )}
          {canPayDeposit && (
            <Button
              onClick={handlePayDeposit}
              disabled={payingDeposit}
              className="flex items-center gap-2 whitespace-nowrap"
              style={{ opacity: payingDeposit ? 0.7 : 1 }}
            >
              <Wallet size={18} /> {payingDeposit ? 'Abriendo pago…' : `Pagar fianza · ${euros(deposit)}`}
            </Button>
          )}
        </div>
      </div>

      <Card className="border border-gray-200 bg-white p-5">
        <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Timeline legal</p>
            <h2 className="text-lg font-bold text-gray-900">Estado del contrato</h2>
          </div>
          <p className="text-sm text-gray-500">Firma, pago y activación en una sola vista.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          {timeline.map((step) => {
            const isDone = step.state === 'done';
            const isCurrent = step.state === 'current';
            return (
              <div
                key={step.id}
                className={`rounded-xl border p-4 ${
                  isDone
                    ? 'border-emerald-200 bg-emerald-50'
                    : isCurrent
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  ) : isCurrent ? (
                    <Clock3 className="h-5 w-5 text-blue-700" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                  {step.date && <span className="text-xs text-gray-500">{step.date}</span>}
                </div>
                <p className="font-semibold text-gray-900">{step.title}</p>
                <p className="mt-1 text-sm text-gray-600">{step.detail}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold text-gray-400 text-xs uppercase mb-4 tracking-wider">Siguiente acción</h3>
        <div className="space-y-2">
          <p className="text-base font-semibold text-gray-900">{actionSummary.nextAction}</p>
          {actionSummary.blockedReason && (
            <p className="text-sm text-amber-700">Bloqueo actual: {actionSummary.blockedReason}</p>
          )}
          {actionSummary.nextDate && (
            <p className="text-sm text-gray-600">Próxima fecha clave: {actionSummary.nextDate}</p>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="font-bold text-gray-400 text-xs uppercase mb-4 tracking-wider">Resumen Económico</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="text-gray-600 text-sm">Renta Mensual</span>
                <span className="font-bold text-lg">{euros(rent)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                <span className="text-gray-600 text-sm">Fianza</span>
                <span className="font-medium">{euros(deposit)}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-gray-600 text-sm">Duración</span>
                <span className="font-medium text-sm text-right">
                  {formatDate(contract.startDate)} <br/> al <br/>
                  {formatDate(contract.endDate)}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-gray-400 text-xs uppercase mb-4 tracking-wider">Intervinientes</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-full"><User size={16} className="text-blue-600"/></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Arrendador</p>
                  <p className="font-medium text-gray-900">{contract.landlordName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                 <div className="bg-green-100 p-2 rounded-full"><User size={16} className="text-green-600"/></div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-bold">Arrendatario</p>
                  <p className="font-medium text-gray-900">{contract.tenantName}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 min-h-[600px] shadow-inner relative overflow-hidden">
            {!isSigned && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] rotate-[-45deg]">
                <span className="text-9xl font-black uppercase">Borrador</span>
              </div>
            )}

            <div className="max-w-2xl mx-auto bg-white shadow-sm border border-gray-200 p-8 min-h-[800px] text-sm text-gray-800 font-serif leading-relaxed">
              <h2 className="text-center font-bold text-xl uppercase mb-8 border-b pb-4">Contrato de Arrendamiento</h2>
              <p className="mb-4">En {property?.city || contract.city || '—'}, a {signedAt ? formatDate(signedAt) : new Date().toLocaleDateString('es-ES')}.</p>
              <p className="mb-4">
                <strong>REUNIDOS:</strong><br/>
                De una parte, D./Dña {contract.landlordName} (ARRENDADOR).<br/>
                Y de otra, D./Dña {contract.tenantName} (ARRENDATARIO).
              </p>
              <p className="mb-4">
                <strong>ACUERDAN:</strong><br/>
                El arrendamiento de la finca urbana sita en {address || '—'},
                con renta mensual de {euros(rent)}.
              </p>
              <div className="pl-4 border-l-2 border-gray-200 my-6 space-y-2 italic text-gray-600">
                <p>1. Duración: Del {formatDate(contract.startDate)} al {formatDate(contract.endDate)}.</p>
                <p>2. Renta: {euros(rent)} mensuales pagaderos los primeros 5 días.</p>
                <p>3. Fianza: {euros(deposit)}.</p>
                {contract.petsAllowed ? <p>4. Mascotas: Permitidas.</p> : <p>4. Mascotas: No permitidas.</p>}
              </div>
              <div className="mt-12 pt-8 border-t border-gray-300 grid grid-cols-2 gap-8">
                {[
                  { label: 'El Arrendador', name: contract.landlordName },
                  { label: 'El Arrendatario', name: contract.tenantName },
                ].map((party) => (
                  <div key={party.label} className="text-center">
                    <div className="h-16 flex flex-col items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 font-sans text-xs">
                      {isSigned ? (
                        <>
                          <span className="font-semibold text-gray-700">{party.name || 'Firmado'}</span>
                          <span className="text-gray-500">
                            Firmado electrónicamente{signedAt ? ` · ${formatDate(signedAt)}` : ''}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-400">Pendiente de firma electrónica</span>
                      )}
                    </div>
                    <p className="text-xs uppercase font-bold border-t border-gray-300 pt-2 mt-2">{party.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={isSigning}
        onClose={() => setIsSigning(false)}
        title="Firma Segura - Signaturit"
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
          <div className="flex flex-col items-center justify-center h-full space-y-4">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
             <p className="text-gray-500">Conectando con el proveedor de confianza...</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
