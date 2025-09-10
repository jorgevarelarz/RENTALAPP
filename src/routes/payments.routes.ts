import { Router } from 'express';
import { body } from 'express-validator';
import { stripe } from '../utils/stripe';
import { User } from '../models/user.model';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';

const r = Router();

r.post('/payments/customer', async (req, res) => {
  const userId = req.header('x-user-id');
  if (!userId) return res.status(400).json({ error: 'Missing x-user-id' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  if (!user.stripeCustomerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { appUserId: user.id } });
    user.stripeCustomerId = customer.id;
    await user.save();
  }
  res.json({ customerId: user.stripeCustomerId });
});

r.post(
  '/payments/intent',
  authenticate,
  [body('amountEUR').isNumeric().custom(v => v > 0)],
  validate,
  asyncHandler(async (req, res) => {
    const { amountEUR } = req.body;
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amountEUR * 100),
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
    });
    res.json({ clientSecret: intent.client_secret });
  }),
);

export default r;
