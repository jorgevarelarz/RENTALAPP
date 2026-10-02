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
        label: 'Expediente incompleto',
        tone: 'warning',
        detail: 'El contrato sigue en borrador y todavía no se ha enviado a firma.',
        nextAction: role === 'landlord' || role === 'admin' ? 'Revisar datos y enviarlo a firma' : 'Esperar validación del arrendador',
        blockedReason: 'Faltan pasos previos antes de firma',
      };
    case 'pending_signature':
    case 'signing':
      return {
        label: 'Firmas pendientes',
        tone: 'warning',
        detail: 'El contrato ya está preparado, pero aún falta completar la firma electrónica.',
        nextAction: 'Revisar las firmas del contrato',
        blockedReason: 'La firma no está completada',
      };
    case 'signed':
      return {
        label: 'Contrato firmado',
        tone: 'info',
        detail: 'El contrato está firmado y pendiente de activación operativa.',
        nextAction: contract.depositPaid ? 'Revisar activación del contrato' : 'Confirmar fianza o pago inicial',
        blockedReason: contract.depositPaid ? null : 'Falta completar el pago inicial',
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
        detail: 'Este expediente ya no requiere gestión operativa normal.',
        nextAction: 'Consultar histórico o documentación',
        nextDate: endLabel,
      };
    default:
      return {
        label: getContractStatusLabel(contract.status),
        tone: 'neutral',
        detail: 'Estado no clasificado todavía.',
        nextAction: 'Revisar expediente',
      };
  }
}
