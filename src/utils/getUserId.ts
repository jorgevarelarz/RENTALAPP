import { Request } from 'express';

/**
 * Retrieves the user ID from the `x-user-id` header. Returns an empty string if not present.
 */
export function getUserId(req: Request): string {
  return String(req.headers['x-user-id'] || '');
}
