import { Router } from 'express';
import { body } from 'express-validator';
import { register, login } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
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
router.post(
  '/login',
  [body('email').isEmail(), body('password').isString().notEmpty()],
  validate,
  asyncHandler(login),
);
export default router;
