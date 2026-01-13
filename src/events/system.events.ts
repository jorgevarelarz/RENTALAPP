import { EventEmitter } from 'events';

export type SystemEventPayload = {
  type: string;
  resourceType?: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
};

export const systemEvents = new EventEmitter();

export function emitSystemEvent(event: SystemEventPayload) {
  systemEvents.emit(event.type, event);
  systemEvents.emit('systemEvent', event);
}
