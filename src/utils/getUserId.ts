import { Request } from 'express';

/**
 * Retrieves the user ID from the `x-user-id` header.
 * Throws a 400 error if the header is missing.
 */
export function getUserId(req: Request): string {
  const uid = req.header('x-user-id');
  if (!uid) throw Object.assign(new Error('Missing x-user-id'), { status: 400 });
  return String(uid);
}
