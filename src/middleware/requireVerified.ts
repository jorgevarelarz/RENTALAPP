import { Request, Response, NextFunction } from 'express';
import { Verification } from '../models/verification.model';
import { getUserId } from '../utils/getUserId';

/**
 * Middleware that ensures the requesting user has a verified status.
 * The user ID is expected in the `x-user-id` header.
 */
export const requireVerified = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
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
