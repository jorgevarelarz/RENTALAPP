import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userRole = (req as any)?.user?.role;
  if (userRole !== 'admin') {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}
