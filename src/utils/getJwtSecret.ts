import { logger } from './logger';

export function getJwtSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (!jwtSecret && isProd) {
    throw new Error('JWT_SECRET is required in production');
  }
  if (!jwtSecret) {
    logger.warn('[auth] JWT_SECRET no configurado — usando clave de prueba');
  }
  return jwtSecret || 'test-only-secret';
}
