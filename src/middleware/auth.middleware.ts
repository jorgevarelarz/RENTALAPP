import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getJwtSecret } from '../utils/getJwtSecret';
import { User } from '../models/user.model';

const EFFECTIVE_JWT_SECRET = getJwtSecret();

export const SESSION_EXPIRED = 'Tu sesión ha caducado. Vuelve a iniciar sesión.';

/**
 * Lee la cuenta del token: versión de sesión (`tokenVersion`), rol e `isVerified`.
 * El token es de la versión vigente si coincide con `tokenVersion`; tokens anteriores a esta
 * comprobación no llevan `tv` y cuentan como versión 0, igual que los usuarios sin el campo.
 * Si la cuenta ya no existe (borrada), el token deja de valer igual que uno revocado.
 * Sin conexión a Mongo no se comprueba (la ruta fallará igualmente al consultar la base).
 */
const loadSessionUser = async (decoded: any): Promise<{ revoked: boolean; user?: any }> => {
  const id = decoded?._id || decoded?.id;
  if (mongoose.connection.readyState !== 1 || !id || !mongoose.isValidObjectId(id)) return { revoked: false };
  const user = await User.findById(id).select('tokenVersion role isVerified').lean();
  if (!user) return { revoked: true };
  const revoked = (Number((user as any).tokenVersion) || 0) !== (Number(decoded.tv) || 0);
  return { revoked, user };
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
  let sessionUser: any;
  try {
    const session = await loadSessionUser(decoded);
    if (session.revoked) {
      return res.status(401).json({ error: SESSION_EXPIRED, code: 'session_expired' });
    }
    sessionUser = session.user;
  } catch {
    return res.status(503).json({ error: 'Servicio no disponible' });
  }
  const resolvedId = decoded._id || decoded.id;

  // Resolver isVerified del token si existe; no asumir false por defecto todavía
  const tokenClaim: boolean | undefined =
    decoded.isVerified ?? decoded.verified ?? decoded.is_verified ??
    (decoded.status ? decoded.status === 'verified' : undefined);
  // Rol y verificación mandan desde la base: un cambio de rol o una verificación retirada se
  // aplica en la siguiente petición, no al caducar el token (7 días)
  let tokenVerified: boolean | undefined = sessionUser ? Boolean(sessionUser.isVerified) : tokenClaim;

  // En entorno de test, permitir bypass cuando ALLOW_UNVERIFIED=true
  if (process.env.NODE_ENV === 'test' && process.env.ALLOW_UNVERIFIED === 'true') {
    // Permitir forzar vía cabecera si se proporciona (útil en tests negativos)
    const verifiedHeader = req.headers['x-user-verified'];
    if (verifiedHeader !== undefined) {
      tokenVerified = ['true', '1', 'yes'].includes(String(verifiedHeader).toLowerCase());
    } else if (typeof tokenClaim === 'undefined' && !tokenVerified) {
      tokenVerified = true; // por defecto verificado en tests
    }
  }

  req.user = {
    ...decoded,
    ...(sessionUser?.role ? { role: sessionUser.role } : {}),
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
    if ((await loadSessionUser(decoded)).revoked) return next();
  } catch {
    return next();
  }
  return authenticate(req, res, next);
};
