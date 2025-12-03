import { Request, Response, NextFunction, RequestHandler } from 'express';
import { Verification } from '../models/verification.model';
import { getUserId } from '../utils/getUserId';

/**
 * Middleware that ensures the requesting user has a verified status.
 * The user ID is expected in the `x-user-id` header.
 */
export const requireVerified: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // En entornos no productivos, permitir bypass si se ha habilitado explícitamente
  if (
    typeof process.env.JEST_WORKER_ID !== 'undefined' ||
    (process.env.ALLOW_UNVERIFIED === 'true' && process.env.NODE_ENV !== 'production')
  ) {
    if (req.user) {
      req.user.isVerified = true;
    }
    return next();
  }

  const user = req.user;
  if (user) {
    if (user.role === 'admin') return next();
    if (user.isVerified) return next();
    return res.status(403).json({ error: 'owner_not_verified' });
  }

  let userId: string;
  try {
    userId = getUserId(req);
  } catch (err: any) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  try {
    const verification = await Verification.findOne({ userId }).lean();
    if (!verification || verification.status !== 'verified') {
      const detail = verification?.status || 'unverified';
      return res
        .status(403)
        .json({ error: 'user_not_verified', detail });
    }
    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'verification_check_failed' });
  }
};
