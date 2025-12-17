import { EventEmitter } from 'events';

export type AuditTrailUpdate = {
  contractId: string;
  status?: string;
  at: string;
};

export const auditTrailEvents = new EventEmitter();

export function emitAuditTrailUpdate(update: AuditTrailUpdate) {
  auditTrailEvents.emit('auditTrailUpdated', update);
}

