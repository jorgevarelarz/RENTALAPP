import type { Contract, ContractStatus } from '../types/contract';

type UserRole = 'tenant' | 'landlord' | 'pro' | 'admin' | string | undefined;

export type ContractActionSummary = {
  label: string;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
  detail: string;
  nextAction: string;
  nextDate?: string | null;
  blockedReason?: string | null;
};

const statusLabels: Record<ContractStatus, string> = {
  draft: 'Borrador',
  generated: 'Borrador',
  pending_signature: 'Pendiente de firma',
  signing: 'Pendiente de firma',
  signed: 'Firmado',
  active: 'Activo',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
  terminated: 'Rescindido',
};

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('es-ES');
};

const isSoon = (value?: string | null, days = 30) => {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  const diff = parsed.getTime() - Date.now();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
};

export function getContractStatusLabel(status: ContractStatus | string | undefined) {
  return status ? statusLabels[status as ContractStatus] || status : 'Estado';
}

export function getContractActionSummary(contract: Contract, role?: UserRole): ContractActionSummary {
  const endLabel = formatDate(contract.endDate);
  const startLabel = formatDate(contract.startDate);

  switch (contract.status) {
    case 'draft':
    case 'generated':
      return {
        label: 'En borrador',
        tone: 'warning',
        detail: 'El contrato está en borrador y todavía no se ha enviado a firmar.',
        nextAction:
          role === 'landlord' || role === 'admin'
            ? 'Revisa los datos y envíalo a firmar'
            : role === 'agency'
              ? 'Revisa los datos con el propietario, que es quien lo envía a firmar'
              : 'El propietario lo enviará a firmar cuando esté listo',
        blockedReason: null,
      };
    case 'pending_signature':
    case 'signing':
      return {
        label: 'Firmas pendientes',
        tone: 'warning',
        detail: 'El contrato está listo; falta completar la firma electrónica.',
        nextAction: role === 'tenant' ? 'Revisa y firma el contrato' : 'Esperar a que firmen las partes',
        blockedReason: null,
      };
    case 'signed':
      return {
        label: 'Contrato firmado',
        tone: 'info',
        detail: contract.depositPaid
          ? `Firmado y con la fianza pagada. Se activa solo${startLabel ? ` el ${startLabel}` : ' en la fecha de inicio'}.`
          : 'El contrato está firmado. Falta pagar la fianza para que se active en la fecha de inicio.',
        nextAction: contract.depositPaid
          ? 'No tienes que hacer nada más'
          : role === 'tenant'
            ? 'Paga la fianza'
            : 'Esperar a que el inquilino pague la fianza',
        blockedReason: contract.depositPaid ? null : 'Falta pagar la fianza',
        nextDate: startLabel,
      };
    case 'active':
      return {
        label: isSoon(contract.endDate) ? 'Renovación próxima' : 'Contrato activo',
        tone: isSoon(contract.endDate) ? 'warning' : 'success',
        detail: isSoon(contract.endDate)
          ? `Este contrato vence pronto${endLabel ? `, el ${endLabel}` : ''}.`
          : `El contrato está activo${endLabel ? ` hasta el ${endLabel}` : ''}.`,
        nextAction: isSoon(contract.endDate) ? 'Revisar renovación o cierre' : 'Seguir pagos e incidencias',
        nextDate: endLabel,
      };
    case 'completed':
    case 'cancelled':
    case 'terminated':
      return {
        label: 'Contrato cerrado',
        tone: 'neutral',
        detail: 'Este contrato ya no está en vigor.',
        nextAction: 'Puedes consultar el contrato y descargar su PDF',
        nextDate: endLabel,
      };
    default:
      return {
        label: getContractStatusLabel(contract.status),
        tone: 'neutral',
        detail: 'No reconocemos el estado de este contrato.',
        nextAction: 'Revisa el contrato o escribe a soporte',
      };
  }
}
