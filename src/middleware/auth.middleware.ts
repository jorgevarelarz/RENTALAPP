import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';

/**
 * Authentication middleware. Verifies a JWT from the Authorization header
 * (expected as a Bearer token) and attaches the decoded user payload to
 * the request object as req.user.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};