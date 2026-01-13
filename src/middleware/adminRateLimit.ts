import { Request, Response, NextFunction } from 'express';
import { SystemEvent } from '../models/systemEvent.model';
import { emitSystemEvent } from '../events/system.events';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const buckets = new Map<string, { count: number; resetAt: number; notified: boolean }>();

function getKey(req: Request) {
  const userId = (req as any)?.user?.id || (req as any)?.user?._id;
  if (userId) return `user:${userId}`;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  return `ip:${String(ip)}`;
}

export async function adminRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = getKey(req);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS, notified: false });
    return next();
  }

  if (bucket.count >= MAX_REQUESTS) {
    if (!bucket.notified) {
      bucket.notified = true;
      const requestId = (res.locals as any)?.requestId;
      const payload = {
        type: 'ADMIN_RATE_LIMIT_HIT',
        resourceType: 'admin',
        resourceId: requestId || `rate-limit-${key}-${bucket.resetAt}`,
        payload: {
          key,
          path: req.originalUrl,
          method: req.method,
          ip: req.ip,
          userId: (req as any)?.user?.id || null,
          requestId,
          windowMs: WINDOW_MS,
          maxRequests: MAX_REQUESTS,
        },
      };

      try {
        await SystemEvent.create(payload);
        emitSystemEvent({ ...payload, createdAt: new Date().toISOString() });
      } catch (err) {
        console.error('Error logging admin rate limit event:', err);
      }
    }

    res.status(429).json({ error: 'too_many_requests' });
    return;
  }

  bucket.count += 1;
  next();
}
