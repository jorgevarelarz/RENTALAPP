import React, { useCallback, useEffect, useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useToast } from '../../context/ToastContext';
import { ContractParty, inviteCoTenant, listContractParties, signAsCoTenant } from '../../services/coTenants';

const STATUS_LABEL: Record<ContractParty['status'], string> = {
  INVITED: 'Invitación enviada',
  JOINED: 'Pendiente de firma',
  SIGNED: 'Firmado',
  REJECTED: 'Rechazada',
  REMOVED_PENDING_ADMIN: 'Baja solicitada',
  REMOVED: 'Dado de baja',
};

const INVITE_ERRORS: Record<string, string> = {
  already_invited: 'Ese correo ya está invitado a este contrato.',
  email_required: 'Escribe el correo de la persona que quieres invitar.',
};

type Props = {
  contractId: string;
  contractStatus: string;
  myUserId?: string;
  /** Solo el inquilino principal puede invitar. */
  canInvite: boolean;
  /** Tras firmar como co-titular el estado del contrato puede cambiar. */
  onSigned?: () => void;
};

/** Personas que comparten el contrato como inquilinos: estado, invitación y firma del co-titular. */
export default function CoTenantsCard({ contractId, contractStatus, myUserId, canInvite, onSigned }: Props) {
  const { push } = useToast();
  const [parties, setParties] = useState<ContractParty[]>([]);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [signing, setSigning] = useState(false);

  const load = useCallback(async () => {
    try {
      const items = await listContractParties(contractId);
      setParties(Array.isArray(items) ? items : []);
    } catch {
      setParties([]);
    }
  }, [contractId]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = parties.filter((p) => p.status !== 'REMOVED');
  const mine = canInvite ? undefined : visible.find((p) => myUserId && p.user?.id === myUserId && !String(p.partyId).startsWith('legacy:'));
  const signingOpen = contractStatus === 'pending_signature' || contractStatus === 'signing';
  const inviteOpen = canInvite && !['completed', 'terminated', 'cancelled'].includes(contractStatus);

  if (visible.length <= 1 && !inviteOpen && !mine) return null;

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setInviting(true);
    try {
      await inviteCoTenant(contractId, value);
      setEmail('');
      push({ title: `Invitación enviada a ${value}`, tone: 'success' });
      await load();
    } catch (error: any) {
      const code = error?.response?.data?.error;
      push({ title: INVITE_ERRORS[code] || 'No se pudo enviar la invitación', tone: 'error' });
    } finally {
      setInviting(false);
    }
  };

  const sign = async () => {
    if (!mine) return;
    setSigning(true);
    try {
      await signAsCoTenant(contractId, String(mine.partyId));
      push({ title: 'Has firmado el contrato como co-titular', tone: 'success' });
      await load();
      onSigned?.();
    } catch {
      push({ title: 'No se pudo registrar tu firma', tone: 'error' });
    } finally {
      setSigning(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="font-bold text-gray-400 text-xs uppercase mb-4 tracking-wider">Co-titulares</h3>
      <ul className="space-y-3">
        {visible.map((p) => (
          <li key={String(p.partyId)} className="min-w-0 [overflow-wrap:anywhere]">
            <p className="font-medium text-gray-900">{p.user?.name || p.email || 'Invitado'}</p>
            {p.user?.name && p.email && <p className="text-xs text-gray-500">{p.email}</p>}
            <p className={`mt-0.5 text-xs font-medium ${p.status === 'SIGNED' ? 'text-emerald-700' : 'text-gray-500'}`}>
              {STATUS_LABEL[p.status] || p.status}
            </p>
          </li>
        ))}
      </ul>

      {mine?.status === 'JOINED' && signingOpen && (
        <Button className="mt-4 w-full" onClick={sign} disabled={signing}>
          {signing ? 'Firmando…' : 'Firmar como co-titular'}
        </Button>
      )}

      {inviteOpen && (
        <form onSubmit={invite} className="mt-4 border-t border-gray-100 pt-4 space-y-2">
          <Input
            type="email"
            label="Invitar a otra persona"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-gray-500">Le llegará un enlace válido 48 horas para unirse y firmar.</p>
          <Button type="submit" variant="secondary" size="sm" disabled={inviting || !email.trim()}>
            {inviting ? 'Enviando…' : 'Enviar invitación'}
          </Button>
        </form>
      )}
    </Card>
  );
}
