export function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (!jwtSecret && isProd) {
    throw new Error('JWT_SECRET is required in production');
  }
  if (!jwtSecret) {
    // Warn in dev/test to avoid silent fallback usage.
    console.warn('WARNING: JWT_SECRET not set, using test-only-secret');
  }
  return jwtSecret || 'test-only-secret';
}
