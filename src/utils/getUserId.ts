import { Request } from 'express';

/**
 * Retrieves the user ID from the authenticated request or, in test-only flows,
 * the `x-user-id` header.
 * Priority:
 * 1) `req.user.id` (set by auth middleware when using JWTs)
 * 2) `x-user-id` header (used only in NODE_ENV=test with auth bypass enabled)
 * If neither is present, throws a 400 error.
 */
export function getUserId(req: Request): string {
  const u: any = (req as any).user;
  if (u?.id || u?._id) return String(u.id || u._id);
  const uid = req.header('x-user-id');
  const allowTestHeader = process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_AUTH === 'true';
  if (uid && allowTestHeader) return String(uid);
  throw Object.assign(new Error('Missing authenticated user identity'), { status: 401 });
}
