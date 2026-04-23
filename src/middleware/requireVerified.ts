import { Request, Response, NextFunction } from 'express';
import { Verification } from '../models/verification.model';
import { getUserId } from '../utils/getUserId';

/**
 * Middleware that ensures the requesting user has a verified status.
 * In production, identity must come from the authenticated user payload.
 */
export const requireVerified = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user;
  if (user) {
    if (user.role === 'admin') return next();
    if (user.isVerified) return next();
    // If token doesn't include verification, fall back to DB status
    try {
      const userId = String(user.id || user._id || '');
      if (userId) {
        const verification = await Verification.findOne({ userId }).lean();
        if (verification?.status === 'verified') {
          user.isVerified = true;
          return next();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'verification_check_failed';
      return res.status(500).json({ error: msg });
    }
    return res.status(403).json({ error: 'owner_not_verified' });
  }

  // Dev bypass: allow skipping verification when explicitly enabled and not in production
  if (process.env.ALLOW_UNVERIFIED === 'true' && process.env.NODE_ENV !== 'production') {
    return next();
  }
  let userId: string;
  try {
    userId = getUserId(req);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    return res.status(e.status || 400).json({ error: e.message });
  }

  try {
    const verification = await Verification.findOne({ userId }).lean();
    if (!verification || verification.status !== 'verified') {
      const detail = verification?.status || 'unverified';
      return res.status(403).json({ error: 'user_not_verified', detail });
    }
    next();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'verification_check_failed';
    res.status(500).json({ error: msg });
  }
};
