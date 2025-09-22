import { authenticate } from './auth.middleware';
import { requireVerified } from './requireVerified';
import { authorizeRoles } from './role.middleware';

export const assertRole = (...roles: string[]) => [authenticate as any, requireVerified as any, authorizeRoles(...roles) as any];

