import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, requestPasswordReset, resetPassword } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar nuevo usuario
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:    { type: string }
 *               email:   { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               role:    { type: string, enum: [landlord, tenant, pro] }
 *     responses:
 *       201: { description: Usuario creado }
 *       400: { description: Datos inválidos, content: { application/json: { schema: { $ref: '#/components/schemas/Error' } } } }
 *       409: { description: Email ya registrado }
 */
router.post(
  '/register',
  [
    body('name').isString().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['landlord', 'tenant', 'pro']),
  ],
  validate,
  asyncHandler(register),
);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401: { description: Credenciales inválidas }
 */
router.post(
  '/login',
  [body('email').isEmail(), body('password').isString().notEmpty()],
  validate,
  asyncHandler(login),
);

/**
 * @openapi
 * /api/auth/request-reset:
 *   post:
 *     tags: [Auth]
 *     summary: Solicitar reseteo de contraseña
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Email enviado si el usuario existe }
 */
router.post(
  '/request-reset',
  [body('email').isEmail()],
  validate,
  asyncHandler(requestPasswordReset),
);

/**
 * @openapi
 * /api/auth/reset:
 *   post:
 *     tags: [Auth]
 *     summary: Confirmar nueva contraseña con token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token:    { type: string }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200: { description: Contraseña actualizada }
 *       400: { description: Token inválido o expirado }
 */
router.post(
  '/reset',
  [body('token').isString().notEmpty(), body('password').isLength({ min: 6 })],
  validate,
  asyncHandler(resetPassword),
);

export default router;
