import { Router } from 'express';
import { body } from 'express-validator';
import { stripe } from '../utils/stripe';
import { User } from '../models/user.model';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

const r = Router();

/**
 * Crea (si no existe) o devuelve el Stripe Customer del usuario autenticado.
 */
r.post(
  '/payments/customer',
  authenticate,
  asyncHandler(async (req: any, res) => {
    const userId = req.user?.id ?? req.header('x-user-id');
    if (!userId) return res.status(400).json({ error: 'missing_user' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'user_not_found' });

    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { appUserId: user.id },
      });
      user.stripeCustomerId = customer.id;
      await user.save();
    }

    res.json({ customerId: user.stripeCustomerId });
  })
);

/**
 * Crea un PaymentIntent en EUR.
 */
r.post(
  '/payments/intent',
  authenticate,
  asyncHandler(async (req, res) => {
    const raw = (req.body as any)?.amountEUR;
    const amountEUR = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof amountEUR !== 'number' || !isFinite(amountEUR) || amountEUR <= 0) {
      return res.status(400).json({ error: 'invalid_amount' });
    }

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amountEUR * 100),
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
    });

    res.json({ clientSecret: intent.client_secret });
  })
);

export default r;
