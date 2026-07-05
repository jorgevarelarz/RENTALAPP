import { randomUUID } from 'crypto';
import { Request } from 'express';
import { SystemEvent } from '../models/systemEvent.model';
import { emitSystemEvent } from '../events/system.events';

export type FunnelEventType =
  | 'visit'
  | 'register'
  | 'login'
  | 'search'
  | 'application'
  | 'contract'
  | 'payment'
  | 'agency_invite_created'
  | 'agency_invite_accepted';

type FunnelEventOptions = {
  resourceType?: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
};

export async function recordFunnelEvent(req: Request, type: FunnelEventType, options: FunnelEventOptions = {}) {
  try {
    const user = (req as any).user || {};
    const requestId = (req.res?.locals as any)?.requestId || req.headers['x-request-id'];
    const event = {
      type: `FUNNEL_${type.toUpperCase()}`,
      resourceType: options.resourceType || 'funnel',
      resourceId: randomUUID(),
      payload: {
        funnelType: type,
        userId: user._id || user.id || options.meta?.userId,
        role: user.role || options.meta?.role,
        targetResourceType: options.resourceType,
        targetResourceId: options.resourceId,
        requestId,
        path: req.originalUrl || req.url,
        method: req.method,
        ip: req.ip,
        ...(options.meta || {}),
      },
    };

    await SystemEvent.create(event);
    emitSystemEvent({ ...event, createdAt: new Date().toISOString() });
  } catch (error) {
    console.warn('[funnel] event skipped', type, (error as Error)?.message);
  }
}
