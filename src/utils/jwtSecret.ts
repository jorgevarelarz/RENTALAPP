import { JWT_SECRET } from '../config/jwt';

/**
 * Backwards-compatible helper to retrieve the JWT secret.
 * Delegates to the centralized config, which enforces minimum strength.
 */
export function getJwtSecret(): string {
  return JWT_SECRET;
}
