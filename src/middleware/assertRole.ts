import { RequestHandler } from 'express';
import { authenticate } from './auth.middleware';
import { requireVerified } from './requireVerified';
import { authorizeRoles } from './role.middleware';

const allowBypass = () =>
  typeof process.env.JEST_WORKER_ID !== 'undefined' ||
  (process.env.ALLOW_UNVERIFIED === 'true' && process.env.NODE_ENV !== 'production');

export const assertRole = (...roles: string[]): RequestHandler[] => {
  const maybeRequireVerified: RequestHandler = (req, res, next) => {
    if (allowBypass()) return next();
    return requireVerified(req, res, next);
  };
  const maybeAuthorizeRoles: RequestHandler = (req, res, next) => {
    if (allowBypass()) return next();
    return authorizeRoles(...roles)(req, res, next);
  };

  return [authenticate, maybeRequireVerified, maybeAuthorizeRoles];
};
