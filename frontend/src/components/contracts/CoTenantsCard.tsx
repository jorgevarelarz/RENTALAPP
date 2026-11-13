import React, { useCallback, useEffect, useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useToast } from '../../context/ToastContext';
import {
  ContractParty,
  cancelCoTenantInvite,
  emailNotDelivered,
  inviteCoTenant,
  listContractParties,
  resendCoTenantInvite,
  signAsCoTenant,
} from '../../services/coTenants';

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

const RESEND_ERRORS: Record<string, string> = {
  resend_too_soon: 'Ya se envió hace poco. Podrás reenviarla dentro de unos minutos.',
  not_invited: 'Esa persona ya aceptó la invitación.',
  contract_closed: 'El contrato está cerrado.',
};

const ACTION =
  'text-xs font-semibold text-[var(--ra-blue)] hover:underline disabled:cursor-default disabled:text-gray-400 disabled:no-underline';

const formatExpiry = (value?: string) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const statusText = (p: ContractParty) => {
  if (p.status !== 'INVITED') return STATUS_LABEL[p.status] || p.status;
  if (p.expired) return 'Invitación caducada';
  if (p.emailFailed) return 'No se pudo enviar el correo';
  const until = formatExpiry(p.expiresAt);
  return until ? `Invitación enviada · caduca el ${until}` : STATUS_LABEL.INVITED;
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
  const [resending, setResending] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

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
      const { emailStatus } = await inviteCoTenant(contractId, value);
      setEmail('');
      push(
        emailNotDelivered(emailStatus)
          ? { title: `Invitación guardada, pero el correo a ${value} no salió. Reenvíala en unos minutos.`, tone: 'error' }
          : { title: `Invitación enviada a ${value}`, tone: 'success' },
      );
      await load();
    } catch (error: any) {
      const code = error?.response?.data?.error;
      push({ title: INVITE_ERRORS[code] || 'No se pudo enviar la invitación', tone: 'error' });
    } finally {
      setInviting(false);
    }
  };

  const resend = async (party: ContractParty) => {
    const partyId = String(party.partyId);
    setResending(partyId);
    try {
      const { emailStatus } = await resendCoTenantInvite(contractId, partyId);
      push(
        emailNotDelivered(emailStatus)
          ? { title: `El correo a ${party.email} no salió. Inténtalo de nuevo en unos minutos.`, tone: 'error' }
          : { title: `Invitación reenviada a ${party.email}`, tone: 'success' },
      );
      await load();
    } catch (error: any) {
      const code = error?.response?.data?.error;
      push({ title: RESEND_ERRORS[code] || 'No se pudo reenviar la invitación', tone: 'error' });
    } finally {
      setResending(null);
    }
  };

  const cancel = async (party: ContractParty) => {
    const partyId = String(party.partyId);
    setCancelling(partyId);
    try {
      await cancelCoTenantInvite(contractId, partyId);
      push({ title: `Invitación a ${party.email} cancelada. El enlace ya no vale.`, tone: 'success' });
      await load();
    } catch (error: any) {
      const code = error?.response?.data?.error;
      push({
        title: code === 'not_invited' ? 'Esa persona ya aceptó la invitación.' : 'No se pudo cancelar la invitación',
        tone: 'error',
      });
      await load();
    } finally {
      setCancelling(null);
      setConfirmCancel(null);
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
    <Card className="px-5 py-4">
      <h2 className="mb-3 font-semibold text-gray-900">Co-titulares</h2>
      <ul className="space-y-3">
        {visible.map((p) => (
          <li key={String(p.partyId)} className="min-w-0 [overflow-wrap:anywhere]">
            <p className="font-medium text-gray-900">{p.user?.name || p.email || 'Invitado'}</p>
            {p.user?.name && p.email && <p className="text-xs text-gray-500">{p.email}</p>}
            <p
              className={`mt-0.5 text-xs font-medium ${
                p.status === 'SIGNED'
                  ? 'text-emerald-700'
                  : p.status === 'INVITED' && (p.expired || p.emailFailed)
                    ? 'text-amber-700'
                    : 'text-gray-500'
              }`}
            >
              {statusText(p)}
            </p>
            {inviteOpen && p.status === 'INVITED' && confirmCancel !== String(p.partyId) && (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <button
                  type="button"
                  className={ACTION}
                  onClick={() => resend(p)}
                  disabled={resending === String(p.partyId)}
                  aria-label={`Reenviar invitación a ${p.email}`}
                >
                  {resending === String(p.partyId) ? 'Enviando…' : 'Reenviar invitación'}
                </button>
                <button
                  type="button"
                  className={`${ACTION} text-gray-500`}
                  onClick={() => setConfirmCancel(String(p.partyId))}
                  disabled={resending === String(p.partyId)}
                  aria-label={`Cancelar invitación a ${p.email}`}
                >
                  Cancelar invitación
                </button>
              </div>
            )}
            {inviteOpen && p.status === 'INVITED' && confirmCancel === String(p.partyId) && (
              <div className="mt-1 text-xs text-gray-600">
                <span>El enlace dejará de valer. </span>
                <span className="inline-flex gap-x-3">
                  <button
                    type="button"
                    className={`${ACTION} text-red-700`}
                    onClick={() => cancel(p)}
                    disabled={cancelling === String(p.partyId)}
                  >
                    {cancelling === String(p.partyId) ? 'Cancelando…' : 'Sí, cancelar'}
                  </button>
                  <button
                    type="button"
                    className={`${ACTION} text-gray-500`}
                    onClick={() => setConfirmCancel(null)}
                    disabled={cancelling === String(p.partyId)}
                  >
                    No
                  </button>
                </span>
              </div>
            )}
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
