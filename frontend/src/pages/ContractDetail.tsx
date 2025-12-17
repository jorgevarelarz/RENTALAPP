import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { downloadPdf, getContract, payDeposit, signContract, sendToSignature } from '../services/contracts';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import ChatPanel from '../components/ChatPanel';
import Card from '../components/ui/Card';
import ProBadge from '../components/ProBadge';
import CopyLinkButton from '../components/CopyLinkButton';
import { useToast } from '../context/ToastContext';

const ContractDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [c, setC] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();
  const [sending, setSending] = useState(false);
  const [embeddedUrls, setEmbeddedUrls] = useState<{ landlordUrl?: string; tenantUrl?: string } | null>(null);

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
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed') === 'true') {
      push({ title: 'Contrato firmado correctamente', tone: 'success' });
      load();
    }
  }, [load, push]);

  if (loading) return <div>Cargando contrato...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!c) return <div>Contrato no encontrado.</div>;

  const amTenant = user?._id === c.tenant?.id || user?._id === c.tenant;
  const amLandlord = user?._id === c.owner?.id || user?._id === c.landlord;
  const canSign = (amTenant && !c.signedByTenant) || (amLandlord && !c.signedByLandlord);
  const canPayDeposit = amTenant && !c.depositPaid;
  const canSendToSignature = (amLandlord || user?.role === 'admin') && ((!c.signature?.status) || ['none','error'].includes(String(c.signature?.status)));
  const signatureStatus = (c.signature?.status as string) || 'none';

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
          <span style={{
            padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700,
            background: signatureStatus === 'completed' ? '#dcfce7' : signatureStatus === 'sent' ? '#dbeafe' : signatureStatus === 'declined' || signatureStatus === 'error' ? '#fee2e2' : '#f3f4f6',
            color: signatureStatus === 'completed' ? '#166534' : signatureStatus === 'sent' ? '#1d4ed8' : signatureStatus === 'declined' || signatureStatus === 'error' ? '#991b1b' : '#374151',
          }}>
            {signatureStatus.toUpperCase()}
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
