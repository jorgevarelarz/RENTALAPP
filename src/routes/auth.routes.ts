import { NextFunction, Request, Response, Router } from 'express';
import { body } from 'express-validator';
import { register, login, requestPasswordReset, resetPassword } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  exchangeOAuthCode,
  finishOAuth,
  listOAuthProviders,
  startOAuth,
} from '../controllers/oauth.controller';

const router = Router();
router.get('/oauth/providers', asyncHandler(listOAuthProviders));
router.get(
  '/oauth/:provider/start',
  (req: Request, res: Response, next: NextFunction) => {
    if (!['google', 'apple'].includes(req.params.provider)) {
      return res.status(404).json({ message: 'Proveedor no disponible' });
    }
    next();
  },
  asyncHandler(startOAuth),
);
router.get('/oauth/:provider/callback', asyncHandler(finishOAuth));
router.post('/oauth/:provider/callback', asyncHandler(finishOAuth));
router.post(
  '/oauth/exchange',
  [body('code').isString().isLength({ min: 20, max: 200 })],
  validate,
  asyncHandler(exchangeOAuthCode),
);
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
router.post(
  '/request-reset',
  [body('email').isEmail()],
  validate,
  asyncHandler(requestPasswordReset),
);
router.post(
  '/reset',
  [body('token').isString().notEmpty(), body('password').isLength({ min: 6 })],
  validate,
  asyncHandler(resetPassword),
);
export default router;
