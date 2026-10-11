import { Router } from 'express';
import { stripe } from '../utils/stripe';
import { stripeIdentityProvider } from '../identity/stripeIdentity';
import { IdentityCheck } from '../models/identityCheck.model';
import { authenticate } from '../middleware/auth.middleware';
import { getUserId } from '../utils/getUserId';
import { frontendUrl } from '../utils/frontendUrl';

const router = Router();

const DEFAULT_KYC_RETURN_PATH = '/tenant/kyc';

/**
 * Destino de vuelta tras verificar la identidad. Solo se aceptan rutas internas del frontend
 * («/tenant/kyc?x=1»); una URL absoluta, «//otro.dominio» o «/\otro» abriría una redirección
 * a un dominio ajeno con la marca de la app. Lo demás vuelve a la página de verificación.
 */
export const kycReturnUrl = (requested: unknown) => {
  const fallback = frontendUrl(DEFAULT_KYC_RETURN_PATH);
  const path = typeof requested === 'string' ? requested.trim() : '';
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u001f]/.test(path)) return fallback;
  try {
    const url = frontendUrl(path);
    // «/..//otro.dominio» se normaliza a «//otro.dominio»: se exige el mismo origen al final
    return new URL(url).origin === new URL(fallback).origin ? url : fallback;
  } catch {
    return fallback;
  }
};

// Start identity verification session — requires authenticated user
router.post('/start', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    const returnUrl = kycReturnUrl(req.body?.returnUrl);
    const session = await stripeIdentityProvider.createSession({ userId, returnUrl });
    await IdentityCheck.create({ userId, provider: 'stripe', sessionId: session.sessionId, status: 'created' });
    res.json(session);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Webhook from Stripe Identity — public but HMAC-verified when secret is configured
router.post('/webhook', async (req, res) => {
  const secret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
  // Sin secreto el cuerpo no se verifica: en producción no se acepta
  if (!secret && process.env.NODE_ENV === 'production') {
    return res.status(503).json({ error: 'identity_webhook_secret_missing' });
  }

  if (secret) {
    const sig = req.headers['stripe-signature'];
    if (!sig) return res.status(400).json({ error: 'missing_signature' });

    let event: any;
    try {
      const rawBody: Buffer = (req as any).rawBody;
      if (!rawBody) return res.status(400).json({ error: 'missing_raw_body' });
      event = stripe.webhooks.constructEvent(rawBody, sig as string, secret);
    } catch (err: any) {
      return res.status(400).json({ error: `webhook_signature_invalid: ${err.message}` });
    }

    const session = event.data?.object;
    const sessionId: string | undefined = session?.id;
    const stripeStatus: string | undefined = session?.status;
    const lastError = session?.last_error ?? null;

    const internalStatus =
      stripeStatus === 'verified' ? 'verified'
      : stripeStatus === 'processing' ? 'processing'
      : stripeStatus === 'requires_input' ? 'requires_input'
      : stripeStatus === 'canceled' ? 'canceled'
      : 'processing';

    if (sessionId) {
      await IdentityCheck.findOneAndUpdate(
        { sessionId },
        { $set: { status: internalStatus, result: { stripeStatus, lastError } } },
        { upsert: true },
      );
    }
  } else {
    // Dev/mock path: no signature verification, body is plain JSON
    const { sessionId, status, result } = req.body || {};
    if (sessionId) {
      await IdentityCheck.findOneAndUpdate(
        { sessionId },
        { $set: { status: status || 'processing', result } },
        { upsert: true },
      );
    }
  }

  res.json({ received: true });
});

export default router;
