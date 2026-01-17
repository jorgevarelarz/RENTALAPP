import { Request, Response, NextFunction } from 'express';
import { User } from '../models/user.model';

export type InstitutionScope = {
  areaKeys: string[];
};

export async function loadInstitutionScope(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const user = await User.findById(userId).select('institutionScope').lean();
    if (!user) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const rawAreaKeys = (user as any).institutionScope?.areaKeys || [];
    const areaKeys = Array.isArray(rawAreaKeys)
      ? rawAreaKeys
          .map((key: string) => String(key).trim().toLowerCase())
          .filter(Boolean)
      : [];

    if (areaKeys.length === 0) {
      return res.status(403).json({ error: 'institution_scope_missing' });
    }

    (req as any).institutionScope = { areaKeys } as InstitutionScope;
    return next();
  } catch (error) {
    return res.status(500).json({ error: 'institution_scope_failed' });
  }
}
