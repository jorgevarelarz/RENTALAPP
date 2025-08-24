import express, { Router } from 'express';
import { stripe } from '../utils/stripe';
import { Contract } from '../models/contract.model';
import Stripe from 'stripe';

const r = Router();

r.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      const contractId = intent.metadata?.contractId as string | undefined;
      if (contractId) {
        await Contract.findByIdAndUpdate(contractId, { lastPaidAt: new Date(), paymentRef: intent.id });
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      // handle payment failure notification logic
      break;
    }
    case 'charge.refunded': {
      // handle refund record logic
      break;
    }
  }

  res.json({ received: true });
});

export default r;
