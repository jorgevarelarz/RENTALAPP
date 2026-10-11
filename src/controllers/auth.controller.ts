import { Request, Response } from 'express';
import { User } from '../models/user.model';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendEmail } from '../utils/email';
import { signAuthToken } from '../utils/authToken';
import { frontendUrl } from '../utils/frontendUrl';
import { recordFunnelEvent } from '../services/funnelEvents.service';

export const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos';

let cachedDummyHash: string | null = null;
const dummyPasswordHash = () => {
  if (!cachedDummyHash) cachedDummyHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
  return cachedDummyHash;
};

/**
 * Register a new user.
 *
 * Expects: name, email, password and role in the request body.
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;
    // Generate the password hash
    const passwordHash = await bcrypt.hash(password, 10);
    // Save new user with hashed password
    const user = new User({ name, email, passwordHash, role });
    await user.save();
    await recordFunnelEvent(req, 'register', {
      resourceType: 'user',
      resourceId: String(user._id),
      meta: { userId: String(user._id), role: user.role },
    });
    const isVerified = Boolean((user as any).isVerified);
    const token = signAuthToken(user);
    res.status(201).json({
      token,
      user: { _id: user._id, email: user.email, role: user.role, isVerified },
    });
  } catch (error) {
    res.status(400).json({ error: 'Error al registrar' });
  }
};

/**
 * Authenticate a user and return a signed JWT.
 *
 * Expects: email and password in the request body.
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    // Find the user by email
    const user = await User.findOne({ email }).select('+passwordHash');
    // Misma respuesta y mismo coste (un bcrypt) si la cuenta no existe, es solo de Google/Apple
    // o la contraseña no coincide: el login no revela qué correos están registrados.
    const storedHash = (user?.passwordHash as string | undefined) || dummyPasswordHash();
    const isMatch = await bcrypt.compare(String(password), storedHash);
    if (!user || !user.passwordHash || !isMatch) {
      return res.status(400).json({ message: INVALID_CREDENTIALS });
    }
    await recordFunnelEvent(req, 'login', {
      resourceType: 'user',
      resourceId: String(user._id),
      meta: { userId: String(user._id), role: user.role },
    });
    // Generate and return JWT
    const isVerified = Boolean((user as any).isVerified);
    const token = signAuthToken(user);
    res.json({
      token,
      user: { _id: user._id, email: user.email, role: user.role, isVerified },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
};

// En la BD solo se guarda el hash del token: quien lea la colección no puede usar los enlaces.
export const hashResetToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetToken = hashResetToken(token);
      user.resetTokenExp = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save();
      const link = frontendUrl('/reset', { token });
      await sendEmail(
        user.email,
        'Restablece tu contraseña de RentalApp',
        `<p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
<p><a href="${link}">Elegir una contraseña nueva</a></p>
<p>El enlace caduca en una hora y solo se puede usar una vez. Si no lo has pedido tú, ignora este correo.</p>`,
      );
    }
  } catch (error) {
    console.error('Error generating password reset token', error);
  }

  res.json({ ok: true });
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      resetToken: hashResetToken(String(token)),
      resetTokenExp: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'El enlace no es válido o ha caducado. Pide uno nuevo.' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExp = undefined;
    // Cierra las sesiones abiertas: quien tuviera la contraseña antigua deja de entrar.
    (user as any).tokenVersion = (Number((user as any).tokenVersion) || 0) + 1;
    // Quien recupera la cuenta por email demuestra que controla ese correo.
    if (!(user as any).emailVerifiedAt) (user as any).emailVerifiedAt = new Date();
    await user.save();

    res.json({ ok: true });
  } catch (error) {
    console.error('Error resetting password', error);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
};
