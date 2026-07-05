import { Request, Response } from 'express';
import { User } from '../models/user.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendEmail } from '../utils/email';
import { getJwtSecret } from '../utils/getJwtSecret';
import { recordFunnelEvent } from '../services/funnelEvents.service';

const EFFECTIVE_JWT_SECRET = getJwtSecret();
const authTokenPayload = (user: any) => {
  const payload: any = { id: user._id, role: user.role };
  if (user.isVerified) payload.isVerified = true;
  return payload;
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
    const token = jwt.sign(authTokenPayload(user), EFFECTIVE_JWT_SECRET, { expiresIn: '7d' });
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
    if (!user) return res.status(400).json({ message: 'Usuario o contraseña incorrectos' });
    // Compare provided password with stored hash
    const isMatch = await bcrypt.compare(password, user.passwordHash as string);
    if (!isMatch) return res.status(400).json({ message: 'Usuario o contraseña incorrectos' });
    await recordFunnelEvent(req, 'login', {
      resourceType: 'user',
      resourceId: String(user._id),
      meta: { userId: String(user._id), role: user.role },
    });
    // Generate and return JWT
    const isVerified = Boolean((user as any).isVerified);
    const token = jwt.sign(authTokenPayload(user), EFFECTIVE_JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { _id: user._id, email: user.email, role: user.role, isVerified },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor' });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(20).toString('hex');
      user.resetToken = token;
      user.resetTokenExp = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      await sendEmail(
        user.email,
        'Password reset',
        `Reset link: https://frontend/reset?token=${token}`,
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
      resetToken: token,
      resetTokenExp: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExp = undefined;
    await user.save();

    res.json({ ok: true });
  } catch (error) {
    console.error('Error resetting password', error);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
};
