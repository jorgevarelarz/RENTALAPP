import { Request } from 'express';

/**
 * Retrieves the user ID from the authenticated request or the `x-user-id` header.
 * Priority:
 * 1) `req.user.id` (set by auth middleware when using JWTs)
 * 2) `x-user-id` header (used in tests/dev without JWT)
 * If neither is present, throws a 400 error.
 */
export function getUserId(req: Request): string {
  const u: any = (req as any).user;
  if (u?.id || u?._id) return String(u.id || u._id);
  const uid = req.header('x-user-id');
  if (uid) return String(uid);
  throw Object.assign(new Error('Missing user identity'), { status: 400 });
}
