import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../utils/getJwtSecret';

const EFFECTIVE_JWT_SECRET = getJwtSecret();

/**
 * Authentication middleware. Verifies a JWT from the Authorization header
 * (expected as a Bearer token) and attaches the decoded user payload to
 * the request object as req.user.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    const allowBypass = process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_AUTH === 'true';
    if (allowBypass) {
      const idHeader = (req.headers['x-user-id'] as string) || '000000000000000000000001';
      const roleHeader = (req.headers['x-user-role'] as string) || 'landlord';
      const verifiedHeader = req.headers['x-user-verified'];
      const isVerified =
        verifiedHeader !== undefined
          ? ['true', '1', 'yes'].includes(String(verifiedHeader).toLowerCase())
          : true;

      req.user = {
        id: idHeader,
        _id: idHeader,
        role: roleHeader,
        isVerified,
      };
      return next();
    }
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET) as any;
    const resolvedId = decoded._id || decoded.id;

    // Resolver isVerified del token si existe; no asumir false por defecto todavía
    let tokenVerified: boolean | undefined =
      decoded.isVerified ?? decoded.verified ?? decoded.is_verified ??
      (decoded.status ? decoded.status === 'verified' : undefined);

    // En entorno de test, permitir bypass cuando ALLOW_UNVERIFIED=true
    if (process.env.NODE_ENV === 'test' && process.env.ALLOW_UNVERIFIED === 'true') {
      // Permitir forzar vía cabecera si se proporciona (útil en tests negativos)
      const verifiedHeader = req.headers['x-user-verified'];
      if (verifiedHeader !== undefined) {
        tokenVerified = ['true', '1', 'yes'].includes(String(verifiedHeader).toLowerCase());
      } else if (typeof tokenVerified === 'undefined') {
        tokenVerified = true; // por defecto verificado en tests
      }
    }

    req.user = {
      ...decoded,
      id: resolvedId,
      _id: resolvedId,
      isVerified: typeof tokenVerified === 'boolean' ? tokenVerified : false,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
};
