import { Router } from 'express';
import { stripe } from '../utils/stripe';
import { User } from '../models/user.model';
import { logger } from '../utils/logger';

const r = Router();

// Las agencias vuelven a su panel; el resto, a «Cobros» del propietario (ver /connect/return en app.ts).
const panelOf = (role?: string) => (role === 'agency' ? 'agency' : 'landlord');

const pct = (name: string) => {
  const value = Number(process.env[name] || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

// Create or retrieve Express account and return onboarding link
r.post('/owner/link', async (req, res) => {
  try {
    const ownerId = (req as any).user?.id;
    if (!ownerId) return res.status(401).json({ error: 'unauthorized' });

    const owner = await User.findById(ownerId);
    if (!owner) return res.status(404).json({ error: 'owner_not_found' });

    const isAgency = owner.role === 'agency';
    if (!owner.stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'ES',
        email: owner.email,
        // Una agencia puede ser sociedad o autónomo: lo elige en el alta de Stripe.
        ...(isAgency ? {} : { business_type: 'individual' as const }),
        capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
        business_profile: {
          mcc: '6513',
          product_description: isAgency
            ? 'Comisiones de agencia por contratos de alquiler gestionados en RentalApp'
            : 'Cobro de rentas y fianzas entre inquilinos y propietarios',
        },
      });
      owner.stripeAccountId = account.id;
      await owner.save();
    }

    const panel = panelOf(owner.role);
    const link = await stripe.accountLinks.create({
      account: owner.stripeAccountId!,
      refresh_url: `${process.env.APP_URL}/connect/refresh?panel=${panel}`,
      return_url: `${process.env.APP_URL}/connect/return?panel=${panel}`,
      type: 'account_onboarding',
    });

    res.json({ accountId: owner.stripeAccountId, url: link.url });
  } catch (error: any) {
    logger.error({ err: error, userId: (req as any).user?.id }, 'stripe_connect_link_failed');
    res.status(502).json({ error: 'stripe_connect_failed' });
  }
});

// Retrieve account status
r.get('/owner/status', async (req, res) => {
  try {
    const ownerId = (req as any).user?.id;
    if (!ownerId) return res.status(401).json({ error: 'unauthorized' });

    // Comisiones vigentes: se enseñan antes de activar los cobros.
    const fees = { rentPct: pct('PLATFORM_RENT_FEE_PCT'), signPct: pct('PLATFORM_SIGN_FEE_PCT') };
    res.setHeader('Cache-Control', 'no-store');

    const owner = await User.findById(ownerId).lean();
    if (!owner?.stripeAccountId) return res.json({ connected: false, ready: false, fees });

    const acct = await stripe.accounts.retrieve(owner.stripeAccountId);
    res.json({
      connected: true,
      // `ready`: la cuenta ya puede recibir el dinero (lo que exige services/rentCharge.service).
      ready: acct.capabilities?.transfers === 'active',
      charges_enabled: acct.charges_enabled,
      payouts_enabled: acct.payouts_enabled,
      details_submitted: acct.details_submitted,
      requirements: {
        currently_due: acct.requirements?.currently_due || [],
        current_deadline: acct.requirements?.current_deadline || null,
        disabled_reason: acct.requirements?.disabled_reason || null,
      },
      fees,
    });
  } catch (error: any) {
    logger.error({ err: error, userId: (req as any).user?.id }, 'stripe_connect_status_failed');
    res.status(502).json({ error: 'stripe_connect_failed' });
  }
});

export default r;
