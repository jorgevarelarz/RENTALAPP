import { Request, Response, NextFunction } from 'express';
import { SystemEvent } from '../models/systemEvent.model';
import { emitSystemEvent } from '../events/system.events';
import { getRedisClient } from '../utils/redis';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

const buckets = new Map<string, { count: number; resetAt: number; notified: boolean }>();

function getKey(req: Request) {
  const userId = (req as any)?.user?.id || (req as any)?.user?._id;
  if (userId) return `user:${userId}`;
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  return `ip:${String(ip)}`;
}

async function emitRateLimitEvent(opts: {
  key: string;
  requestId?: string;
  userId?: string | null;
  ip?: string;
  path: string;
  method: string;
  resourceId: string;
}) {
  const payload = {
    type: 'ADMIN_RATE_LIMIT_HIT',
    resourceType: 'admin',
    resourceId: opts.resourceId,
    payload: {
      key: opts.key,
      path: opts.path,
      method: opts.method,
      ip: opts.ip,
      userId: opts.userId || null,
      requestId: opts.requestId,
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

async function checkRateLimitRedis(req: Request, res: Response, key: string) {
  const redis = getRedisClient();
  if (!redis) return { limited: false, supported: false };

  const now = Date.now();
  const window = Math.floor(now / WINDOW_MS);
  const counterKey = `admin_rate:${key}:${window}`;
  const notifyKey = `admin_rate_notify:${key}:${window}`;

  try {
    const count = await redis.incr(counterKey);
    if (count === 1) {
      await redis.pexpire(counterKey, WINDOW_MS);
    }

    if (count > MAX_REQUESTS) {
      const notified = await redis.set(notifyKey, '1', 'PX', WINDOW_MS, 'NX');
      if (notified === 'OK') {
        const requestId = (res.locals as any)?.requestId;
        await emitRateLimitEvent({
          key,
          requestId,
          userId: (req as any)?.user?.id || null,
          ip: req.ip,
          path: req.originalUrl,
          method: req.method,
          resourceId: requestId || `rate-limit-${key}-${window}`,
        });
      }
      return { limited: true, supported: true };
    }

    return { limited: false, supported: true };
  } catch (err) {
    console.warn('[rate-limit] redis fallback:', (err as any)?.message || err);
    return { limited: false, supported: false };
  }
}

function checkRateLimitMemory(req: Request, res: Response, key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS, notified: false });
    return { limited: false };
  }

  if (bucket.count >= MAX_REQUESTS) {
    if (!bucket.notified) {
      bucket.notified = true;
      const requestId = (res.locals as any)?.requestId;
      emitRateLimitEvent({
        key,
        requestId,
        userId: (req as any)?.user?.id || null,
        ip: req.ip,
        path: req.originalUrl,
        method: req.method,
        resourceId: requestId || `rate-limit-${key}-${bucket.resetAt}`,
      });
    }
    return { limited: true };
  }

  bucket.count += 1;
  return { limited: false };
}

export async function adminRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = getKey(req);
  const redisResult = await checkRateLimitRedis(req, res, key);

  if (!redisResult.supported) {
    const memoryResult = checkRateLimitMemory(req, res, key);
    if (memoryResult.limited) {
      res.status(429).json({ error: 'too_many_requests' });
      return;
    }
    next();
    return;
  }

  if (redisResult.limited) {
    res.status(429).json({ error: 'too_many_requests' });
    return;
  }

  next();
}
