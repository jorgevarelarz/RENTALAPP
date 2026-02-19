import express, { Router } from 'express';
import { Types } from 'mongoose';
import { stripe } from '../utils/stripe';
import { Contract } from '../models/contract.model';
import Stripe from 'stripe';
import ServiceOffer from '../models/serviceOffer.model';
import Appointment from '../models/appointment.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import PlatformEarning from '../models/platformEarning.model';
import ProcessedEvent from '../models/processedEvent.model';
import { Payment } from '../models/payment.model';
import { User } from '../models/user.model';
import { sendPaymentReceiptEmail } from '../utils/email';
import { calcServiceFee } from '../utils/calcServiceFee';
import { recordContractHistory } from '../utils/history';
import { transitionContract } from '../services/contractState';
import { ensureDirectConversation } from '../utils/ensureDirectConversation';
import { RentPayment } from '../models/rentPayment.model';
import { PartnerEarning } from '../models/partnerEarning.model';
import { Property } from '../models/property.model';
import { calcPartnerShareCents, getAgencySharePctFromEnv, parsePositiveInt } from '../utils/partnerEarnings';

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

async function maybePayAgencyRentFeeShare(params: {
  eventId: string;
  intent: Stripe.PaymentIntent;
}): Promise<void> {
  const { eventId, intent } = params;
  const md = intent.metadata || {};
  const paymentKind = (md.kind || md.type) as string | undefined;
  if (paymentKind !== 'rent') return;

  const contractIdStr = typeof md.contractId === 'string' ? md.contractId : undefined;
  if (!contractIdStr || !Types.ObjectId.isValid(contractIdStr)) return;

  const rentFeeCents = parsePositiveInt((md as any).rentFeeCents);
  if (!rentFeeCents) return;

  const sharePct = getAgencySharePctFromEnv();
  if (sharePct <= 0) return;

  const partnerShareCents = calcPartnerShareCents(rentFeeCents, sharePct);
  if (partnerShareCents <= 0) return;

  const existing = await PartnerEarning.findOne({ stripeEventId: eventId, kind: 'rent_fee_share' }).lean();
  if (existing?.stripeTransferId) return;
  if (existing?.status === 'failed') return;

  const contract = await Contract.findById(contractIdStr).select('agencyId property').lean();
  if (!contract) return;

  const propertyId = (contract as any).property;
  let agencyId: any = (contract as any).agencyId;
  if (!agencyId) {
    const p = await Property.findById(propertyId).select('agencyId').lean();
    agencyId = (p as any)?.agencyId;
  }
  if (!agencyId) return;

  const agency = await User.findById(agencyId).select('stripeAccountId').lean();
  if (!agency?.stripeAccountId) return;

  // Stripe idempotency protects against duplicate transfers on webhook retry.
  const transferGroup = `contract:${contractIdStr}`;
  const currency = intent.currency || 'eur';
  const destinationStripeAccountId = agency.stripeAccountId;
  const idempotencyKey = `partner_earning:rent_fee_share:${eventId}`;

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: partnerShareCents,
        currency,
        destination: destinationStripeAccountId,
        transfer_group: transferGroup,
        metadata: {
          kind: 'rent_fee_share',
          contractId: contractIdStr,
          stripePaymentIntentId: intent.id,
          sharePct: String(sharePct),
          platformFeeCents: String(rentFeeCents),
        },
      },
      { idempotencyKey },
    );

    await PartnerEarning.create({
      kind: 'rent_fee_share',
      agencyId: new Types.ObjectId(String(agencyId)),
      contractId: new Types.ObjectId(contractIdStr),
      propertyId: new Types.ObjectId(String(propertyId)),
      stripeEventId: eventId,
      stripePaymentIntentId: intent.id,
      currency,
      platformFeeCents: rentFeeCents,
      sharePct,
      partnerShareCents,
      destinationStripeAccountId,
      transferGroup,
      stripeTransferId: transfer.id,
      status: 'created',
    });
  } catch (e: any) {
    // Controlled retry: mark failed and continue (no infinite Stripe webhook retries).
    // Use an update to tolerate races; unique index enforces one doc per event.
    const errorMsg = String(e?.message || 'transfer_failed');
    await PartnerEarning.updateOne(
      { stripeEventId: eventId, kind: 'rent_fee_share' },
      {
        $setOnInsert: {
          kind: 'rent_fee_share',
          agencyId: new Types.ObjectId(String(agencyId)),
          contractId: new Types.ObjectId(contractIdStr),
          propertyId: new Types.ObjectId(String(propertyId)),
          stripeEventId: eventId,
          stripePaymentIntentId: intent.id,
          currency,
          platformFeeCents: rentFeeCents,
          sharePct,
          partnerShareCents,
          destinationStripeAccountId,
          transferGroup,
        },
        $set: { status: 'failed', error: errorMsg },
      },
      { upsert: true },
    );
    console.error('[partner_earning] transfer failed', {
      eventId,
      paymentIntentId: intent.id,
      contractId: contractIdStr,
      error: errorMsg,
    });
  }
}

r.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (process.env.NODE_ENV === 'production' && !secret) {
    return res.status(500).json({ error: 'stripe_webhook_secret_missing' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 1. Idempotency Check (Optimistic Locking)
  let processedEventDoc;
  try {
    const metadata = (event.data.object as any)?.metadata || {};
    const rawContractId = typeof metadata.contractId === 'string' ? metadata.contractId : undefined;
    const contractIdForEvent =
      rawContractId && Types.ObjectId.isValid(rawContractId)
        ? new Types.ObjectId(rawContractId)
        : undefined;

    // Check current status
    processedEventDoc = await ProcessedEvent.findOne({ provider: 'stripe', eventId: event.id });

    if (processedEventDoc) {
      if (processedEventDoc.status === 'completed') {
        // Already successfully processed
        return res.json({ received: true, duplicate: true });
      }
      if (processedEventDoc.status === 'pending') {
        // Check staleness (e.g., created > 5 mins ago means previous attempt crashed)
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        if (processedEventDoc.updatedAt > fiveMinsAgo) {
          // Being processed right now by another thread/instance
          return res.json({ received: true, processing: true });
        }
        // Else: Stale pending, assume crash and retry
      }
      // If status is 'failed' or stale 'pending', we proceed to retry
    } else {
      // Create new pending record
      processedEventDoc = await ProcessedEvent.create({
        provider: 'stripe',
        eventId: event.id,
        contractId: contractIdForEvent,
        status: 'pending',
        receivedAt: new Date(),
      });
    }
  } catch (dbErr: any) {
    // If we can't talk to DB, fail hard so Stripe retries
    console.error('Database error during idempotency check:', dbErr);
    return res.status(500).json({ error: 'idempotency_check_failed' });
  }

  // 2. Business Logic Execution
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const contractId = intent.metadata?.contractId as string | undefined;
        const offerId = intent.metadata?.offerId as string | undefined;
        const paymentType = intent.metadata?.type as string | undefined;
        const paymentId = intent.metadata?.paymentId as string | undefined;
        const rentPaymentId = intent.metadata?.rentPaymentId as string | undefined;

        const receiptUrl = (intent as any)?.charges?.data?.[0]?.receipt_url;
        let payment: any = null;

        if (paymentId) {
          payment = await Payment.findByIdAndUpdate(
            paymentId,
            {
              status: 'succeeded',
              paidAt: new Date(),
              receiptUrl,
              stripePaymentIntentId: intent.id,
            },
            { new: true },
          );
        } else if (paymentType === 'rent') {
          payment = await Payment.findOneAndUpdate(
            { stripePaymentIntentId: intent.id },
            {
              status: 'succeeded',
              paidAt: new Date(),
              receiptUrl,
            },
            { new: true },
          );
        }
        if (rentPaymentId) {
          await RentPayment.findOneAndUpdate(
            { _id: rentPaymentId, status: { $ne: 'PAID' } },
            { status: 'PAID', paidAt: new Date(), providerPaymentId: intent.id },
            { new: true },
          );
        }

        if (payment?.payer) {
          const payer = await User.findById(payment.payer).lean();
          if (payer?.email) {
            const amountEur = payment.amount;
            sendPaymentReceiptEmail(
              payer.email,
              payer.name || 'Usuario',
              amountEur,
              payment.concept,
              new Date(),
            ).catch(console.error);
          }
        }

        if (contractId) {
          await Contract.findByIdAndUpdate(contractId, { lastPaidAt: new Date(), paymentRef: intent.id });
        }
        if (contractId || payment?.contract) {
          const contractRef = contractId || String(payment.contract);
          const c = await Contract.findById(contractRef).lean();
          if (c) {
            const direct = await ensureDirectConversation(String(c.landlord), String(c.tenant));
            await publishSystem(direct.id, 'PAYMENT_SUCCEEDED', { contractId: String(c._id) });
          }
        }

        // Partner/agency earnings: share a % of platform rent fee via Stripe Connect transfer.
        await maybePayAgencyRentFeeShare({ eventId: event.id, intent });
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
            const direct = await ensureDirectConversation(String(offer.ownerId), String(offer.proId));
            await publishSystem(direct.id, 'PAYMENT_SUCCEEDED', { offerId });
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
        const rentPaymentId = intent.metadata?.rentPaymentId as string | undefined;
        if (offerId) {
          const offer = await ServiceOffer.findById(offerId);
          if (offer) {
            await publishSystem(offer.conversationId, 'PAYMENT_FAILED', { offerId });
            const direct = await ensureDirectConversation(String(offer.ownerId), String(offer.proId));
            await publishSystem(direct.id, 'PAYMENT_FAILED', { offerId });
          }
        }
        if (rentPaymentId) {
          await RentPayment.findByIdAndUpdate(rentPaymentId, { status: 'FAILED' });
        }
        break;
      }
      case 'payment_intent.processing': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const offerId = intent.metadata?.offerId as string | undefined;
        const rentPaymentId = intent.metadata?.rentPaymentId as string | undefined;
        if (offerId) {
          const offer = await ServiceOffer.findById(offerId);
          if (offer) {
            await publishSystem(offer.conversationId, 'PAYMENT_PROCESSING', { offerId });
            const direct = await ensureDirectConversation(String(offer.ownerId), String(offer.proId));
            await publishSystem(direct.id, 'PAYMENT_PROCESSING', { offerId });
          }
        }
        if (rentPaymentId) {
          await RentPayment.findByIdAndUpdate(rentPaymentId, { status: 'PROCESSING', providerPaymentId: intent.id });
        }
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.deposit === 'true') {
          const contractId = session.metadata?.contractId;
          if (contractId) {
            const contract = await Contract.findById(contractId);
            if (contract && !contract.depositPaid) {
              contract.depositPaid = true;
              contract.depositPaidAt = new Date();
              await contract.save();
              await recordContractHistory(contract.id, 'depositPaid', 'Fianza pagada a través de la plataforma');

              const now = new Date();
              if (contract.status === 'signed') {
                if (contract.startDate && now >= contract.startDate) {
                  try {
                    await transitionContract(contract.id, 'active');
                    await recordContractHistory(
                      contract.id,
                      'activated',
                      'Contrato activado automáticamente tras pago de fianza',
                    );
                    console.log(`Contrato ${contract.id} activado automáticamente.`);
                  } catch (actErr) {
                    console.error(`Error activando contrato ${contract.id}:`, actErr);
                  }
                } else if (contract.startDate) {
                  await recordContractHistory(
                    contract.id,
                    'pending_activation',
                    `Fianza recibida. Activación programada para ${contract.startDate.toISOString()}`,
                  );
                }
              }
            }
          }
        }
        break;
      }
    }

    // 3. Success: Mark as completed
    await ProcessedEvent.updateOne(
      { provider: 'stripe', eventId: event.id },
      { status: 'completed' }
    );

    res.json({ received: true });

  } catch (err: any) {
    // 4. Failure: Mark as failed so we can audit or allow retry (depending on logic, usually allow retry)
    console.error(`Error processing Stripe event ${event.id}:`, err);
    await ProcessedEvent.updateOne(
      { provider: 'stripe', eventId: event.id },
      { status: 'failed', error: err.message }
    );
    // Return 500 so Stripe retries
    res.status(500).json({ error: 'processing_failed' });
  }
});

export default r;
