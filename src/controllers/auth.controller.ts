import { Request, Response } from 'express';
import { User } from '../models/user.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendEmail } from '../utils/email';
import getRequestLogger from '../utils/requestLogger';
import { AppError, badRequest, isAppError } from '../utils/errors';

import { getJwtSecret } from '../config/jwt';

const JWT_SECRET = getJwtSecret();
const DEFAULT_FRONTEND_URL = 'http://localhost:3000';

function buildResetLink(token: string) {
  const encoded = encodeURIComponent(token);
  const template = process.env.PASSWORD_RESET_URL || process.env.PASSWORD_RESET_URL_TEMPLATE;
  if (template) {
    if (template.includes('{{TOKEN}}')) return template.replace(/{{TOKEN}}/g, encoded);
    if (template.includes('%TOKEN%')) return template.replace(/%TOKEN%/g, encoded);
    if (template.includes('{token}')) return template.replace(/{token}/g, encoded);
    try {
      const url = new URL(template);
      url.searchParams.set('token', token);
      return url.toString();
    } catch {
      // ignore malformed template, fall back to defaults
    }
  }

  const base =
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    DEFAULT_FRONTEND_URL;
  const normalized = base.replace(/\/$/, '');
  return `${normalized}/reset?token=${encoded}`;
}

/**
 * Register a new user.
 *
 * Expects: name, email, password and role in the request body.
 */
export const register = async (req: Request, res: Response) => {
  const log = getRequestLogger(req);
  try {
    const { name, email, password, role } = req.body;
    // Generate the password hash
    const passwordHash = await bcrypt.hash(password, 10);
    // Save new user with hashed password
    const user = new User({ name, email, passwordHash, role });
    await user.save();
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: { _id: user._id, email: user.email, role: user.role },
    });
  } catch (error) {
    if (isAppError(error)) throw error;
    log.error({ err: error, email: req.body?.email }, 'Error registrando usuario');
    throw badRequest('Error al registrar', { cause: (error as Error)?.message });
  }
};

/**
 * Authenticate a user and return a signed JWT.
 *
 * Expects: email and password in the request body.
 */
export const login = async (req: Request, res: Response) => {
  const log = getRequestLogger(req);
  log.info({ email: req.body?.email }, 'Login request received');
  try {
    const { email, password } = req.body;
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      throw new AppError('Usuario o contraseña incorrectos', {
        status: 400,
        code: 'invalid_credentials',
      });
    }
    // Compare provided password with stored hash
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Usuario o contraseña incorrectos', {
        status: 400,
        code: 'invalid_credentials',
      });
    }
    // Generate and return JWT
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { _id: user._id, email: user.email, role: user.role },
    });
  } catch (error) {
    if (isAppError(error)) {
      log.warn({ err: error, email: req.body?.email }, 'Login falló (error controlado)');
      throw error;
    }
    log.error({ err: error, email: req.body?.email }, 'Error durante login');
    throw new AppError('Error del servidor', { status: 500, code: 'login_failed' });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body;
  const log = getRequestLogger(req);
  try {
    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(20).toString('hex');
      user.resetToken = token;
      user.resetTokenExp = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      const resetUrl = buildResetLink(token);
      const body = [
        'Hola,',
        '',
        'Hemos recibido una solicitud para restablecer tu contraseña en RentalApp.',
        'Puedes crear una nueva contraseña usando el siguiente enlace (caduca en 60 minutos):',
        resetUrl,
        '',
        'Si no has solicitado este cambio, simplemente ignora este mensaje.',
        '',
        'Gracias,',
        'Equipo RentalApp',
      ].join('\n');
      await sendEmail(user.email, 'Restablece tu contraseña', body);
    }
  } catch (error) {
    log.error({ err: error, email }, 'Error generando token de reseteo');
  }

  res.json({ ok: true });
};

export const resetPassword = async (req: Request, res: Response) => {
  const log = getRequestLogger(req);
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      resetToken: token,
      resetTokenExp: { $gt: new Date() },
    });

    if (!user) {
      throw new AppError('Token inválido o expirado', { status: 400, code: 'token_invalid' });
    }

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetToken = undefined;
    user.resetTokenExp = undefined;
    await user.save();

    res.json({ ok: true });
  } catch (error) {
    if (isAppError(error)) throw error;
    log.error({ err: error }, 'Error reseteando contraseña');
    throw new AppError('Error al restablecer la contraseña', {
      status: 500,
      code: 'reset_failed',
    });
  }
};
