import { Router } from 'express';
import { stripe } from '../utils/stripe';
import { Contract } from '../models/contract.model';
import { User } from '../models/user.model';
import { authenticate } from '../middleware/auth.middleware';
import { requirePolicies } from '../middleware/requirePolicies';
import type { PolicyType } from '../models/policy.model';
import { sendRouteError } from '../utils/routeError';
import { billableRent } from '../utils/rentPeriod';
import { isRentChargeError, rentChargeSplit } from '../services/rentCharge.service';

const r = Router();
const REQUIRED_POLICIES: PolicyType[] = ['terms_of_service', 'data_processing'];

// `POST /:id/pay-rent` vive en contract.routes.ts (createRentPaymentIntent). Aquí hubo otra
// implementación con la misma ruta que nunca llegaba a ejecutarse; se retiró el 2026-11-11.

// Cobro con método guardado (off-session). Mismo reparto que el resto de cobros de renta:
// el inquilino paga la renta, va a la cuenta del propietario y la plataforma retiene su comisión.
r.post('/:id/pay-rent-saved', authenticate, requirePolicies(REQUIRED_POLICIES), async (req, res) => {
  const tenantId = (req as any).user?.id;
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });

  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) return res.status(404).json({ error: 'contract_not_found' });
    if (String(contract.tenant) !== String(tenantId)) return res.status(403).json({ error: 'forbidden' });
    if (contract.status !== 'active' && contract.status !== 'signed') {
      return res.status(400).json({ error: 'contract_not_active' });
    }

    const tenant = await User.findById(tenantId).select('stripeCustomerId').lean();
    if (!tenant?.stripeCustomerId) return res.status(400).json({ error: 'no_saved_method' });

    const rent = billableRent(contract);
    if (rent === null) return res.status(400).json({ error: 'invalid_rent' });
    const rentCents = Math.round(rent * 100);

    const paymentMethods = await stripe.paymentMethods.list({ customer: tenant.stripeCustomerId, type: 'card' });
    if (!paymentMethods.data.length) return res.status(400).json({ error: 'no_saved_method' });

    const split = await rentChargeSplit(contract, rentCents);
    const intent = await stripe.paymentIntents.create({
      amount: rentCents,
      currency: 'eur',
      customer: tenant.stripeCustomerId,
      payment_method: paymentMethods.data[0].id,
      off_session: true,
      confirm: true,
      ...split.params,
      metadata: {
        ...split.metadata,
        contractId: String(contract._id),
        tenantId: String(tenantId),
        method: 'card_saved',
      },
    });

    return res.json({ success: true, status: intent.status });
  } catch (err: any) {
    if (isRentChargeError(err)) return res.status(err.status).json({ error: err.code });
    if (err?.code === 'authentication_required' && err?.raw?.payment_intent?.client_secret) {
      return res.status(402).json({
        error: 'authentication_required',
        clientSecret: err.raw.payment_intent.client_secret,
      });
    }
    return sendRouteError(res, err, 'payment_failed');
  }
});

export default r;
