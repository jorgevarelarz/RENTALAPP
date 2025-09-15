import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { downloadPdf, getContract, payDeposit, signContract } from '../services/contracts';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useToast } from '../context/ToastContext';

const ContractDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [c, setC] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

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

  if (loading) return <div>Cargando contrato...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!c) return <div>Contrato no encontrado.</div>;

  const amTenant = user?.id === c.tenant?.id || user?.id === c.tenant;
  const amLandlord = user?.id === c.owner?.id || user?.id === c.landlord;
  const canSign = (amTenant && !c.signedByTenant) || (amLandlord && !c.signedByLandlord);
  const canPayDeposit = amTenant && !c.depositPaid;

  return (
    <div>
      <h1 className="page-title">Detalle del Contrato</h1>
      <Card style={{ padding: 24 }}>
        <p>ID: {c._id || c.id}</p>
        <p>Inquilino: {c.tenant?.id || c.tenant}</p>
        <p>Propietario: {c.owner?.id || c.landlord}</p>
        <p>Firmado por inquilino: {c.signedByTenant ? 'Sí' : 'No'}</p>
        <p>Firmado por propietario: {c.signedByLandlord ? 'Sí' : 'No'}</p>
        <p>Fianza pagada: {c.depositPaid ? 'Sí' : 'No'}</p>
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
    </div>
  );
};

export default ContractDetail;