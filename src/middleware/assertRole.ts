import { RequestHandler } from 'express';
import { authenticate } from './auth.middleware';
import { requireVerified } from './requireVerified';
import { authorizeRoles } from './role.middleware';

export const assertRole = (...roles: string[]): RequestHandler[] => [
  authenticate,
  requireVerified,
  authorizeRoles(...roles) as unknown as RequestHandler,
];
