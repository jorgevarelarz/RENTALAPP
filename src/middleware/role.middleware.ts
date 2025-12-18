import { Request, Response, NextFunction } from 'express';

/**
 * Higher-order middleware to check whether the authenticated user's role is
 * included in the allowed roles list. If not, responds with 403. Assumes
 * authentication has already run and attached req.user.
 */
export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ error: 'No autorizado' });
    }
    next();
  };
};
