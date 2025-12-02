import { Request, Response } from 'express';
import { User } from '../models/user.model';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendEmail } from '../utils/email';
import { signToken } from '../config/jwt';

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
    const userId = String(user._id);
    const token = signToken({ id: userId, _id: userId, role: user.role });
    res.status(201).json({
      token,
      user: { _id: user._id, email: user.email, role: user.role },
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
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Usuario o contraseña incorrectos' });
    // Compare provided password with stored hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Usuario o contraseña incorrectos' });
    // Generate and return JWT
    const userId = String(user._id);
    const token = signToken({ id: userId, _id: userId, role: user.role });
    res.json({
      token,
      user: { _id: user._id, email: user.email, role: user.role },
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
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      user.resetToken = tokenHash;
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
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetToken: tokenHash,
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
