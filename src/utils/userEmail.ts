import { User } from '../models/user.model';

/** Forma canónica de un correo de cuenta: sin espacios y en minúsculas. */
export const normalizeEmail = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

// Comparación sin distinguir mayúsculas (strength 2) para cuentas antiguas guardadas tal como
// se escribieron al registrarse; el índice único de `email` distingue mayúsculas.
const CASE_INSENSITIVE = { locale: 'en', strength: 2 } as const;

/**
 * Busca la cuenta de un correo sin distinguir mayúsculas ni espacios. Primero la forma
 * normalizada (usa el índice); si no está, una cuenta antigua con otras mayúsculas.
 * `select` se pasa tal cual a Mongoose (p. ej. '+passwordHash' o '_id').
 */
export async function findUserByEmail(email: unknown, select?: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const exact = User.findOne({ email: normalized });
  if (select) exact.select(select);
  const user = await exact;
  if (user) return user;
  const legacy = User.findOne({ email: normalized }).collation(CASE_INSENSITIVE);
  if (select) legacy.select(select);
  return legacy;
}

/** Si ya hay una cuenta con ese correo, con cualquier combinación de mayúsculas. */
export async function emailInUse(email: unknown) {
  return Boolean(await findUserByEmail(email, '_id'));
}
