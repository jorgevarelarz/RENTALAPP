import { Router } from 'express';
import { stripe } from '../utils/stripe';
import { Contract } from '../models/contract.model';
import { User } from '../models/user.model';
import { calcPlatformFeeOnRent, calcSurchargeCents } from '../utils/rentFees';

const r = Router();

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
  const amountCents = rentCents + surchargeCents;
  const platformFeeCents = calcPlatformFeeOnRent(rentCents);

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'eur',
    customer: tenant.stripeCustomerId!,
    payment_method: paymentMethodId,
    confirm: true,
    payment_method_types: [method],
    transfer_data: { destination: owner.stripeAccountId! },
    application_fee_amount: platformFeeCents,
    metadata: {
      kind: 'rent',
      contractId: String(contract._id),
      ownerId: String(owner._id),
      tenantId: String(tenant._id),
      method,
      rentCents,
      surchargeCents,
      platformFeeCents,
    },
  });

  contract.paymentRef = intent.id;
  contract.lastPaidAt = new Date();
  await contract.save();

  res.json({
    ok: true,
    intentId: intent.id,
    method,
    rentAmount: rentCents / 100,
    surcharge: surchargeCents / 100,
    platformFee: platformFeeCents / 100,
    totalToTenant: amountCents / 100,
  });
});

export default r;
