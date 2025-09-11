import express, { Router } from 'express';
import { stripe } from '../utils/stripe';
import { Contract } from '../models/contract.model';
import Stripe from 'stripe';
import ServiceOffer from '../models/serviceOffer.model';
import Appointment from '../models/appointment.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import PlatformEarning from '../models/platformEarning.model';
import ProcessedEvent from '../models/processedEvent.model';
import { calcServiceFee } from '../utils/calcServiceFee';

const r = Router();

async function publishSystem(conversationId: string, systemCode: string, payload?: any) {
  await Message.create({ conversationId, senderId: 'system', type: 'system', systemCode, payload, readBy: [] });
  await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });
}

async function ensureContractConversation(contractId: string): Promise<string> {
  let conv = await Conversation.findOne({ kind: 'contract', refId: contractId });
  if (conv) return conv.id;
  const c = await Contract.findById(contractId).lean();
  if (!c) throw new Error('Contract not found');
  conv = await Conversation.create({ kind: 'contract', refId: contractId, participants: [String(c.landlord), String(c.tenant)], meta: { contractId, ownerId: String(c.landlord), tenantId: String(c.tenant) }, unread: {} });
  return conv.id;
}

r.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency: ensure each Stripe event is processed once (atomic upsert)
  try {
    const r = await ProcessedEvent.updateOne(
      { eventId: event.id },
      { $setOnInsert: { eventId: event.id } },
      { upsert: true },
    );
    // If the document already existed, treat as duplicate and ack
    if ((r as any).upsertedCount === 0 && (r as any).matchedCount > 0) {
      return res.json({ received: true, duplicate: true });
    }
  } catch (_e: any) {
    // For DB errors, surface 500 to allow Stripe to retry later
    return res.status(500).json({ error: 'idempotency_store_failed' });
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      const contractId = intent.metadata?.contractId as string | undefined;
      const offerId = intent.metadata?.offerId as string | undefined;
      if (contractId) {
        await Contract.findByIdAndUpdate(contractId, { lastPaidAt: new Date(), paymentRef: intent.id });
      }
      if (offerId) {
        const offer = await ServiceOffer.findById(offerId);
        if (offer) {
          const fee = calcServiceFee(offer.amount);
          offer.status = 'confirmed';
          await offer.save();
          if (offer.appointmentId) {
            await Appointment.findByIdAndUpdate(offer.appointmentId, { status: 'confirmed' });
          }
          const conv = await Conversation.findById(offer.conversationId);
          if (conv) {
            await publishSystem(conv.id, 'PAYMENT_SUCCEEDED', { offerId });
            if (conv.meta?.contractId) {
              const contractConvId = await ensureContractConversation(conv.meta.contractId);
              await publishSystem(contractConvId, 'APPOINTMENT_CONFIRMED', { offerId });
            }
          }
          if (offer.appointmentId) {
            const appointment = await Appointment.findById(offer.appointmentId).lean();
            if (appointment) {
              let aConv = await Conversation.findOne({ kind: 'appointment', refId: offer.appointmentId });
              if (!aConv) {
                aConv = await Conversation.create({ kind: 'appointment', refId: offer.appointmentId, participants: [appointment.proId, appointment.tenantId], meta: { appointmentId: offer.appointmentId, proUserId: appointment.proId, tenantId: appointment.tenantId, ownerId: appointment.ownerId, ticketId: appointment.ticketId }, unread: {} });
              }
              await publishSystem(aConv.id, 'APPOINTMENT_CONFIRMED', { offerId });
            }
          }
          await PlatformEarning.create({ kind: 'service', offerId, proId: offer.proId, serviceKey: offer.serviceKey, gross: fee.gross, fee: fee.fee, netToPro: fee.netToPro, currency: offer.currency, paymentRef: intent.id });
        }
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent;
      const offerId = intent.metadata?.offerId as string | undefined;
      if (offerId) {
        const offer = await ServiceOffer.findById(offerId);
        if (offer) {
          await publishSystem(offer.conversationId, 'PAYMENT_FAILED', { offerId });
        }
      }
      break;
    }
    case 'payment_intent.processing': {
      const intent = event.data.object as Stripe.PaymentIntent;
      const offerId = intent.metadata?.offerId as string | undefined;
      if (offerId) {
        const offer = await ServiceOffer.findById(offerId);
        if (offer) {
          await publishSystem(offer.conversationId, 'PAYMENT_PROCESSING', { offerId });
        }
      }
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
