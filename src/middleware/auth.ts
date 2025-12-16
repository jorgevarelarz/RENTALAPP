import { authenticate } from './auth.middleware';

/**
 * Alias para mantener compatibilidad con requireAuth.
 */
export const requireAuth = authenticate;
export default authenticate;
