import jwt from 'jsonwebtoken';
import { getJwtSecret } from './getJwtSecret';

/**
 * Único punto donde se firma el JWT de sesión. `tv` es la versión de sesión del usuario
 * (`tokenVersion`): al subirla (restablecer la contraseña, anular la de una cuenta vinculada)
 * `authenticate` rechaza todos los tokens emitidos antes.
 */
export const signAuthToken = (user: any) => {
  const payload: any = { id: user._id, role: user.role, tv: Number(user.tokenVersion) || 0 };
  if (user.isVerified) payload.isVerified = true;
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
};
