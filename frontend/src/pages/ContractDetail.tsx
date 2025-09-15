import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { downloadPdf, getContract, payDeposit, signContract } from '../services/contracts';
import { useAuth } from '../auth/AuthContext';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useToast } from '../context/ToastContext';

const ContractDetail: React.FC = () => {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [c, setC] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    if (!token || !user || !id) return;
    try {
      setLoading(true); setError(null);
      const data = await getContract(token, user.id, id);
      setC(data);
    } catch (e: any) {
      setError(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [token, user, id]);

  useEffect(() => { load(); }, [load]);

  if (!token || !user) return <div>Inicia sesión</div>;
  if (loading) return <div>Cargando…</div>;
  if (error) return <div>Error: {error}</div>;
  if (!c) return null;

  const amTenant = String(c.tenantId || c.tenant) === user.id || c.tenant?.id === user.id;
  const amOwner = String(c.ownerId || c.landlord) === user.id || c.owner?.id === user.id;

  const canSignTenant = amTenant && !c.signedByTenant;
  const canSignOwner = amOwner && !c.signedByLandlord;
  const canPayDeposit = amTenant && !c.depositPaid;

  return (
    <div>
      <h2>Contrato <Badge tone={(c.status || 'draft') as any}>{c.status}</Badge></h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card style={{ padding: 16 }}>
          <p><b>Renta:</b> €{c.rent}</p>
          <p><b>Fianza:</b> €{c.deposit}</p>
          <p><b>Arrendador:</b> {String(c.ownerId)}</p>
          <p><b>Inquilino:</b> {String(c.tenantId)}</p>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(canSignTenant || canSignOwner) && (
              <Button onClick={async () => { await signContract(token!, user.id, c._id || c.id); push({ title: 'Contrato firmado', tone: 'success' }); await load(); }}>
                Firmar
              </Button>
            )}
            {canPayDeposit && (
              <Button onClick={async () => { await payDeposit(token!, user.id, c._id || c.id, 'escrow'); push({ title: 'Fianza pagada', tone: 'success' }); await load(); }}>
                Pagar fianza (escrow)
              </Button>
            )}
            <Button onClick={async () => { const blob = await downloadPdf(token!, user.id, c._id || c.id); const url = URL.createObjectURL(blob); window.open(url, '_blank'); }}>Descargar PDF</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ContractDetail;
