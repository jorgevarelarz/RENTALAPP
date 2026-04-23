import { Request, Response, NextFunction } from 'express';
import { User } from '../models/user.model';

export async function loadInstitutionScope(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const user = await User.findById(userId).select('institutionScope').lean();
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const rawAreaKeys = (user as { institutionScope?: { areaKeys?: unknown[] } }).institutionScope?.areaKeys ?? [];
    const areaKeys = Array.isArray(rawAreaKeys)
      ? rawAreaKeys.map(k => String(k).trim().toLowerCase()).filter(Boolean)
      : [];

    if (areaKeys.length === 0) {
      return res.status(403).json({ error: 'institution_scope_missing' });
    }

    req.institutionScope = { areaKeys };
    return next();
  } catch {
    return res.status(500).json({ error: 'institution_scope_failed' });
  }
}
