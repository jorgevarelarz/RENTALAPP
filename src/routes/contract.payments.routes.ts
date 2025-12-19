import { Router } from 'express';
import { stripe } from '../utils/stripe';
import { Contract } from '../models/contract.model';
import { User } from '../models/user.model';
import { calcPlatformFeeOnRent, calcSurchargeCents, calcSignFeeOnRent } from '../utils/rentFees';
import { authenticate } from '../middleware/auth.middleware';
import { requirePolicies } from '../middleware/requirePolicies';
import type { PolicyType } from '../models/policy.model';

const r = Router();
const REQUIRED_POLICIES: PolicyType[] = ['terms_of_service', 'data_processing'];

r.post('/contracts/:id/pay-rent', async (req, res) => {
  const tenantId = req.header('x-user-id');
  if (!tenantId) return res.status(400).json({ error: 'Missing x-user-id' });

  const { method, paymentMethodId } = req.body || {};
  if (!['sepa_debit', 'card', 'bizum'].includes(method)) return res.status(400).json({ error: 'invalid_method' });

  const contract = await Contract.findById(req.params.id);
  if (!contract) return res.status(404).json({ error: 'contract_not_found' });
  if (String(contract.tenant) !== String(tenantId)) return res.status(403).json({ error: 'forbidden' });

  const owner = await User.findById(contract.landlord);
  const tenant = await User.findById(tenantId);
  if (!owner?.stripeAccountId) return res.status(409).json({ error: 'owner_not_connected' });
  if (!tenant?.stripeCustomerId) return res.status(409).json({ error: 'tenant_no_customer' });

  const acct = await stripe.accounts.retrieve(owner.stripeAccountId);
  if (!acct.charges_enabled) return res.status(409).json({ error: 'charges_disabled' });

  const rentBase = contract.rentAmount ?? contract.rent;
  const rentCents = Math.round((rentBase || 0) * 100);
  const surchargeCents = calcSurchargeCents(method, rentCents);
  const signFeeCents = contract.signFeeCollected ? 0 : calcSignFeeOnRent(rentCents);
  const rentFeeCents = calcPlatformFeeOnRent(rentCents);
  const applicationFeeCents = rentFeeCents + signFeeCents;
  const amountCents = rentCents + surchargeCents;

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'eur',
    customer: tenant.stripeCustomerId!,
    payment_method: paymentMethodId,
    confirm: true,
    payment_method_types: [method],
    transfer_data: { destination: owner.stripeAccountId! },
    application_fee_amount: applicationFeeCents,
    metadata: {
      kind: 'rent',
      contractId: String(contract._id),
      ownerId: String(owner._id),
      tenantId: String(tenant._id),
      method,
      rentCents,
      surchargeCents,
      rentFeeCents,
      signFeeCents,
      },
  });

  contract.paymentRef = intent.id;
  contract.lastPaidAt = new Date();
  if (signFeeCents > 0) {
    contract.signFeeCollected = true;
    contract.signFeeCollectedAt = new Date();
  }
  await contract.save();

  res.json({
    ok: true,
    intentId: intent.id,
    method,
    rentAmount: rentCents / 100,
    surcharge: surchargeCents / 100,
    platformFee: rentFeeCents / 100,
    signFee: signFeeCents / 100,
    totalToTenant: amountCents / 100,
  });
});

// Cobro con método guardado (off-session)
r.post('/contracts/:id/pay-rent-saved', authenticate, requirePolicies(REQUIRED_POLICIES), async (req, res) => {
  const tenantId = (req as any).user?.id;
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });

  const contract = await Contract.findById(req.params.id).populate(['landlord', 'tenant']);
  if (!contract) return res.status(404).json({ error: 'contract_not_found' });
  if (String((contract as any).tenant?._id || contract.tenant) !== String(tenantId)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const landlord: any = (contract as any).landlord;
  const tenant: any = (contract as any).tenant;
  if (!landlord?.stripeAccountId) return res.status(400).json({ error: 'owner_not_connected' });
  if (!tenant?.stripeCustomerId) return res.status(400).json({ error: 'no_saved_method' });

  const rentBase = contract.rentAmount ?? contract.rent;
  const rentCents = Math.round((rentBase || 0) * 100);
  const platformFeeCents = calcPlatformFeeOnRent(rentCents);
  const totalChargeCents = rentCents + platformFeeCents;

  const paymentMethods = await stripe.paymentMethods.list({
    customer: tenant.stripeCustomerId,
    type: 'card',
  });
  if (!paymentMethods.data.length) {
    return res.status(400).json({ error: 'no_saved_method' });
  }
  const defaultPaymentMethod = paymentMethods.data[0].id;

  try {
    const intent = await stripe.paymentIntents.create({
      amount: totalChargeCents,
      currency: 'eur',
      customer: tenant.stripeCustomerId,
      payment_method: defaultPaymentMethod,
      off_session: true,
      confirm: true,
      transfer_data: {
        destination: landlord.stripeAccountId,
        amount: rentCents,
      },
      metadata: {
        contractId: String(contract._id),
        landlordId: String(landlord._id),
        tenantId: String(tenant._id),
        period: new Date().toISOString(),
      },
    });

    contract.paymentRef = intent.id;
    contract.lastPaidAt = new Date();
    await contract.save();

    return res.json({ success: true, status: intent.status });
  } catch (err: any) {
    if (err?.code === 'authentication_required' && err?.raw?.payment_intent?.client_secret) {
      return res.status(402).json({
        error: 'authentication_required',
        clientSecret: err.raw.payment_intent.client_secret,
      });
    }
    return res.status(500).json({ error: err?.message || 'payment_failed' });
  }
});

export default r;
