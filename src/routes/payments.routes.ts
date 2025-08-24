import { Router } from 'express';
import { stripe } from '../utils/stripe';
import { User } from '../models/user.model';

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

export default r;
