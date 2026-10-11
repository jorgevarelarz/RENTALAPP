import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getJwtSecret } from '../utils/getJwtSecret';
import { User } from '../models/user.model';

const EFFECTIVE_JWT_SECRET = getJwtSecret();

export const SESSION_EXPIRED = 'Tu sesión ha caducado. Vuelve a iniciar sesión.';

/**
 * Comprueba que el token sea de la versión de sesión vigente del usuario (`tokenVersion`).
 * Tokens anteriores a esta comprobación no llevan `tv` y cuentan como versión 0, igual que los
 * usuarios sin el campo. Si la cuenta no existe se deja pasar, como antes: cada ruta responde.
 * Sin conexión a Mongo no se comprueba (la ruta fallará igualmente al consultar la base).
 */
const isSessionRevoked = async (decoded: any): Promise<boolean> => {
  const id = decoded?._id || decoded?.id;
  if (mongoose.connection.readyState !== 1 || !id || !mongoose.isValidObjectId(id)) return false;
  const user = await User.findById(id).select('tokenVersion').lean();
  if (!user) return false;
  return (Number((user as any).tokenVersion) || 0) !== (Number(decoded.tv) || 0);
};

/**
 * Authentication middleware. Verifies a JWT from the Authorization header
 * (expected as a Bearer token) and attaches the decoded user payload to
 * the request object as req.user.
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
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
  let decoded: any;
  try {
    decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET) as any;
  } catch {
    return res.status(401).json({ error: 'Token inválido', code: 'invalid_token' });
  }
  try {
    if (await isSessionRevoked(decoded)) {
      return res.status(401).json({ error: SESSION_EXPIRED, code: 'session_expired' });
    }
  } catch {
    return res.status(503).json({ error: 'Servicio no disponible' });
  }
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
};

/**
 * Para rutas públicas que muestran más a usuarios identificados: con token válido se comporta
 * como `authenticate`; sin token, o con uno caducado o inválido, sigue como anónimo (sin el
 * bypass de tests). Un token viejo en el navegador no debe romper el listado público.
 */
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
    if (await isSessionRevoked(decoded)) return next();
  } catch {
    return next();
  }
  return authenticate(req, res, next);
};
