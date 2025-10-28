import { Router } from 'express';
import { stripeIdentityProvider } from '../identity/stripeIdentity';
import { IdentityCheck } from '../models/identityCheck.model';
import { getUserId } from '../utils/getUserId';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Webhook handler from identity provider
router.post('/webhook', async (req, res) => {
  // In a real implementation we would verify signatures and parse events.
  const { sessionId, status, result } = req.body || {};
  if (sessionId) {
    await IdentityCheck.findOneAndUpdate(
      { sessionId },
      { $set: { status: status || 'processing', result } },
      { upsert: true },
    );
  }
  res.json({ received: true });
});

router.use(authenticate as any);

// Start identity verification session
router.post('/start', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const returnUrl = req.body?.returnUrl || process.env.APP_URL || '';
  const session = await stripeIdentityProvider.createSession({ userId, returnUrl });
  await IdentityCheck.create({ userId, provider: 'stripe', sessionId: session.sessionId, status: 'created' });
  res.json(session);
});

export default router;
