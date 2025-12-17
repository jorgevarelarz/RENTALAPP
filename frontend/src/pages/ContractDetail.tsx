import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { downloadPdf, getContract, payDeposit, signContract, sendToSignature } from '../services/contracts';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import ChatPanel from '../components/ChatPanel';
import Card from '../components/ui/Card';
import ProBadge from '../components/ProBadge';
import CopyLinkButton from '../components/CopyLinkButton';
import { useToast } from '../context/ToastContext';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  none: 'No iniciado',
  created: 'Borrador de firma',
  sent: 'Enviado a firma',
  completed: 'Firmado correctamente',
  signed: 'Firmado correctamente',
  declined: 'Rechazado',
  error: 'Error en firma',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  completed: { bg: '#dcfce7', color: '#166534' },
  signed: { bg: '#dcfce7', color: '#166534' },
  sent: { bg: '#dbeafe', color: '#1d4ed8' },
  declined: { bg: '#fee2e2', color: '#991b1b' },
  error: { bg: '#fee2e2', color: '#991b1b' },
  default: { bg: '#f3f4f6', color: '#374151' },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircle size={14} className="text-green-600" />,
  signed: <CheckCircle size={14} className="text-green-600" />,
  sent: <Clock size={14} className="text-blue-600" />,
  declined: <XCircle size={14} className="text-red-600" />,
  error: <XCircle size={14} className="text-red-600" />,
};

const ContractDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [c, setC] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();
  const [sending, setSending] = useState(false);
  const [embeddedUrls, setEmbeddedUrls] = useState<{ landlordUrl?: string; tenantUrl?: string } | null>(null);
  const prevSignatureStatusRef = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getContract(token, id);
      setC(data);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar el contrato');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const isInProcess = c?.signature?.status === 'sent' || c?.status === 'signing';
    if (!isInProcess) return;
    const interval = setInterval(() => load(), 5000);
    return () => clearInterval(interval);
  }, [c?.signature?.status, c?.status, load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed') === 'true') {
      push({ title: 'Contrato firmado correctamente', tone: 'success' });
      load();
    }
  }, [load, push]);

  useEffect(() => {
    const current = c?.signature?.status as string | undefined;
    if (prevSignatureStatusRef.current && prevSignatureStatusRef.current !== current) {
      if (current === 'completed' || current === 'signed') push({ title: 'Contrato firmado correctamente', tone: 'success' });
      if (current === 'declined') push({ title: 'La firma fue rechazada', tone: 'error' });
    }
    prevSignatureStatusRef.current = current;
  }, [c?.signature?.status, push]);

  if (loading) return <div>Cargando contrato...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!c) return <div>Contrato no encontrado.</div>;

  const amTenant = user?._id === c.tenant?.id || user?._id === c.tenant;
  const amLandlord = user?._id === c.owner?.id || user?._id === c.landlord;
  const canSign = (amTenant && !c.signedByTenant) || (amLandlord && !c.signedByLandlord);
  const canPayDeposit = amTenant && !c.depositPaid;
  const canSendToSignature = (amLandlord || user?.role === 'admin') && ((!c.signature?.status) || ['none','error'].includes(String(c.signature?.status)));
  const statusKey = (c?.signature?.status as string) || 'none';
  const badgeStyle = STATUS_COLORS[statusKey] || STATUS_COLORS.default;
  const badgeLabel = STATUS_LABELS[statusKey] || 'Desconocido';
  const icon = STATUS_ICONS[statusKey];

  return (
    <div>
      <h1 className="page-title">Detalle del Contrato</h1>
      {user?.role === 'tenant' && user?.tenantPro?.status === 'verified' && (
        <div style={{ marginBottom: 8 }}>
          <ProBadge maxRent={user?.tenantPro?.maxRent} />
        </div>
      )}
      <Card style={{ padding: 24 }}>
        <p>ID: {c._id || c.id}</p>
        <p>Inquilino: {c.tenant?.id || c.tenant}</p>
        <p>Propietario: {c.owner?.id || c.landlord}</p>
        <p>Firmado por inquilino: {c.signedByTenant ? 'Sí' : 'No'}</p>
        <p>Firmado por propietario: {c.signedByLandlord ? 'Sí' : 'No'}</p>
        <p>Fianza pagada: {c.depositPaid ? 'Sí' : 'No'}</p>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <strong>Firma:</strong>
          <span
            title={badgeLabel}
            aria-label={`Estado de firma: ${badgeLabel}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 999,
              backgroundColor: badgeStyle.bg,
              color: badgeStyle.color,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {icon} {badgeLabel}
          </span>
          {canSendToSignature && (
            <button
              disabled={sending}
              onClick={async () => {
                try {
                  setSending(true);
                  const resp = await sendToSignature(token!, c._id || c.id);
                  setEmbeddedUrls(resp.recipientUrls || null);
                  push({ title: 'Contrato enviado a firma', tone: 'success' });
                  await load();
                } catch (e: any) {
                  push({ title: 'No se pudo iniciar la firma', tone: 'error' });
                } finally {
                  setSending(false);
                }
              }}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #111827' }}
            >
              {sending ? 'Enviando…' : 'Enviar a firma'}
            </button>
          )}
          {c.signature?.pdfUrl && (
            <button
              onClick={() => window.open(c.signature.pdfUrl, '_blank')}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #111827' }}
            >
              Ver PDF firmado
            </button>
          )}
        </div>
        {(c?.status === 'signing' || c?.status === 'pending_signature') && (
          <div style={{ marginTop: 8, fontSize: 14 }}>
            {(!c.signedByTenant && 'Esperando firma del inquilino') ||
              (!c.signedByLandlord && 'Esperando firma del propietario')}
          </div>
        )}
        {embeddedUrls && (
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            {embeddedUrls.landlordUrl && <a href={embeddedUrls.landlordUrl} target="_blank" rel="noreferrer">Firmar como propietario</a>}
            {embeddedUrls.tenantUrl && <a href={embeddedUrls.tenantUrl} target="_blank" rel="noreferrer">Firmar como inquilino</a>}
          </div>
        )}
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          {canSign && (
            <Button onClick={async () => { await signContract(token!, c._id || c.id); push({ title: 'Contrato firmado', tone: 'success' }); await load(); }}>
              Firmar contrato
            </Button>
          )}
          {canPayDeposit && (
            <Button onClick={async () => { await payDeposit(token!, c._id || c.id, 'escrow'); push({ title: 'Fianza pagada', tone: 'success' }); await load(); }}>
              Pagar fianza
            </Button>
          )}
          <Button onClick={async () => { const blob = await downloadPdf(token!, c._id || c.id); const url = URL.createObjectURL(blob); window.open(url, '_blank'); }}>
            Descargar PDF
          </Button>
        </div>
      </Card>
      <div style={{ marginTop: 12 }}>
        <CopyLinkButton />
      </div>
      <div style={{ marginTop: 16 }}>
        <ChatPanel kind="contract" refId={c._id || c.id} />
      </div>
    </div>
  );
};

export default ContractDetail;
