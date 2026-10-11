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
import { recordDepositPayment } from '../services/depositPayment.service';
import { ensureDirectConversation } from '../utils/ensureDirectConversation';
import { RentPayment } from '../models/rentPayment.model';
import { PartnerEarning } from '../models/partnerEarning.model';
import { Property } from '../models/property.model';
import { calcPartnerShareCents, parsePositiveInt } from '../utils/partnerEarnings';
import { getAgencySharePct } from '../services/agencyShare.service';
import { CLOSED_DISPUTE_STATUSES, type PaymentDispute } from '../models/paymentDispute.schema';

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

/**
 * Cargo del PaymentIntent y la URL de su recibo. Con la API 2022-11-15 el intent ya no trae
 * `charges`, solo `latest_charge` (ID o, si se expande, el cargo).
 */
async function chargeReceipt(intent: Stripe.PaymentIntent): Promise<{ chargeId?: string; receiptUrl?: string }> {
  const latest = intent.latest_charge;
  if (!latest) return {};
  if (typeof latest !== 'string') return { chargeId: latest.id, receiptUrl: latest.receipt_url || undefined };
  try {
    const charge = await stripe.charges.retrieve(latest);
    return { chargeId: charge.id, receiptUrl: charge.receipt_url || undefined };
  } catch (err) {
    // Sin recibo el pago sigue siendo válido: no hacemos que Stripe reintente el evento.
    console.error('[stripe] no se pudo leer el cargo', latest, err);
    return { chargeId: latest };
  }
}

const intentIdOf = (value: string | Stripe.PaymentIntent | null | undefined): string | undefined =>
  typeof value === 'string' ? value : value?.id;

/**
 * Contrato cuya fianza se cobró con este PaymentIntent. Las fianzas cobradas antes de guardar
 * `depositPaymentIntentId` (y sin metadatos en el intent) se buscan por su sesión de Checkout.
 * Si Stripe no responde, el error sube y el evento se reintenta.
 */
async function findDepositContract(intentId: string, metadata?: Stripe.Metadata | null) {
  const byIntent = await Contract.findOne({ depositPaymentIntentId: intentId });
  if (byIntent) return byIntent;

  let contractId = metadata?.deposit === 'true' ? metadata.contractId : undefined;
  if (!contractId) {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: intentId, limit: 1 });
    const session = sessions.data[0];
    if (session?.metadata?.deposit === 'true') contractId = session.metadata.contractId;
  }
  if (!contractId || !Types.ObjectId.isValid(contractId)) return null;
  return Contract.findOneAndUpdate(
    { _id: contractId, depositPaymentIntentId: { $in: [null, intentId] } },
    { $set: { depositPaymentIntentId: intentId } },
    { new: true },
  );
}

/** Copia de la disputa de Stripe que se guarda junto al cobro (importes en euros). */
function disputeInfo(dispute: Stripe.Dispute, now: Date): PaymentDispute {
  const closed = CLOSED_DISPUTE_STATUSES.includes(dispute.status);
  return {
    id: dispute.id,
    status: dispute.status,
    reason: dispute.reason || undefined,
    amount: Math.round(dispute.amount || 0) / 100,
    openedAt: dispute.created ? new Date(dispute.created * 1000) : now,
    ...(closed ? { closedAt: now } : {}),
  };
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

  const existing = await PartnerEarning.findOne({ stripeEventId: eventId, kind: 'rent_fee_share' }).lean();
  if (existing?.stripeTransferId) return;
  if (existing?.status === 'failed') return;

  const contract = await Contract.findById(contractIdStr).select('agencyId refAgencyId property').lean();
  if (!contract) return;

  // Resolución de agencia: gestora (contrato o propiedad) tiene prioridad;
  // si no hay, cobra la captadora (refAgencyId). Nunca ambas.
  const propertyId = (contract as any).property;
  let agencyId: any = (contract as any).agencyId;
  if (!agencyId) {
    const p = await Property.findById(propertyId).select('agencyId').lean();
    agencyId = (p as any)?.agencyId;
  }
  if (!agencyId) agencyId = (contract as any).refAgencyId;
  if (!agencyId) return;

  // % por tramos de volumen (AGENCY_SHARE_TIERS) o fijo de env como fallback.
  const sharePct = await getAgencySharePct(agencyId);
  if (sharePct <= 0) return;

  const partnerShareCents = calcPartnerShareCents(rentFeeCents, sharePct);
  if (partnerShareCents <= 0) return;

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

        const { chargeId, receiptUrl } = await chargeReceipt(intent);
        let payment: any = null;

        // Un pago ya devuelto no vuelve a `succeeded` si el evento llega tarde o se reenvía.
        if (paymentId) {
          payment = await Payment.findOneAndUpdate(
            { _id: paymentId, status: { $ne: 'refunded' } },
            {
              status: 'succeeded',
              paidAt: new Date(),
              receiptUrl,
              stripeChargeId: chargeId,
              stripePaymentIntentId: intent.id,
            },
            { new: true },
          );
        } else if (paymentType === 'rent') {
          payment = await Payment.findOneAndUpdate(
            { stripePaymentIntentId: intent.id, status: { $ne: 'refunded' } },
            {
              status: 'succeeded',
              paidAt: new Date(),
              receiptUrl,
              stripeChargeId: chargeId,
            },
            { new: true },
          );
        }
        if (rentPaymentId) {
          await RentPayment.findOneAndUpdate(
            { _id: rentPaymentId, status: { $nin: ['PAID', 'REFUNDED'] } },
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
          // Paso atómico a `confirmed`: un reenvío del evento no duplica avisos ni la ganancia.
          // Solo cuenta el intento vigente de la oferta (o cualquiera en ofertas antiguas sin él).
          const offer = await ServiceOffer.findOneAndUpdate(
            {
              _id: offerId,
              status: { $nin: ['confirmed', 'done', 'cancelled'] },
              $or: [{ paymentIntentId: intent.id }, { paymentIntentId: null }],
            },
            { status: 'confirmed', paymentIntentId: intent.id },
            { new: true },
          );
          if (offer) {
            const fee = calcServiceFee(offer.amount);
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
          // El propietario puede reintentar el pago: la oferta vuelve a `scheduled`.
          await ServiceOffer.updateOne(
            { _id: offerId, status: 'payment_pending', paymentIntentId: intent.id },
            { status: 'scheduled' },
          );
          const offer = await ServiceOffer.findById(offerId);
          if (offer) {
            await publishSystem(offer.conversationId, 'PAYMENT_FAILED', { offerId });
            const direct = await ensureDirectConversation(String(offer.ownerId), String(offer.proId));
            await publishSystem(direct.id, 'PAYMENT_FAILED', { offerId });
          }
        }
        // Solo el intento vigente y no pagado pasa a FAILED: un fallo tardío de un intento
        // anterior no debe deshacer un PAID ni pisar un reintento más nuevo.
        if (rentPaymentId) {
          await RentPayment.updateOne(
            { _id: rentPaymentId, status: { $nin: ['PAID', 'REFUNDED'] }, providerPaymentId: intent.id },
            { status: 'FAILED' },
          );
        }
        await Payment.updateOne(
          { stripePaymentIntentId: intent.id, status: { $in: ['pending', 'processing'] } },
          { status: 'failed' },
        );
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
          await RentPayment.updateOne(
            {
              _id: rentPaymentId,
              status: { $nin: ['PAID', 'REFUNDED'] },
              $or: [{ providerPaymentId: intent.id }, { providerPaymentId: null }],
            },
            { status: 'PROCESSING', providerPaymentId: intent.id },
          );
        }
        break;
      }
      case 'charge.refunded': {
        // Devolución desde el panel de Stripe (o la API). Total: el pago y el recibo de renta
        // pasan a devueltos; parcial: solo se anota el importe. Las transferencias ya hechas
        // (parte de la agencia) no se revierten aquí.
        const charge = event.data.object as Stripe.Charge;
        const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        if (!intentId) break;
        const amountRefunded = Math.round(charge.amount_refunded || 0) / 100;
        const fullRefund = charge.refunded === true;
        const refundedAt = new Date();

        const payment = await Payment.findOneAndUpdate(
          { stripePaymentIntentId: intentId, status: { $in: ['succeeded', 'refunded'] } },
          fullRefund
            ? { status: 'refunded', amountRefunded, refundedAt, stripeChargeId: charge.id }
            : { amountRefunded, stripeChargeId: charge.id },
          { new: true },
        );
        const rentPayment = fullRefund
          ? await RentPayment.findOneAndUpdate(
              { providerPaymentId: intentId, status: 'PAID' },
              { status: 'REFUNDED', refundedAt },
              { new: true },
            )
          : null;

        const isDeposit = payment?.type === 'deposit';
        const contractRef = payment?.contract || rentPayment?.contractId;
        if (contractRef && !isDeposit) {
          await recordContractHistory(contractRef, fullRefund ? 'paymentRefunded' : 'paymentPartiallyRefunded', {
            paymentIntentId: intentId,
            amountRefunded,
            period: rentPayment?.period,
          });
          break;
        }
        if (rentPayment || (payment && !isDeposit)) break;

        // Devolución de la fianza: se anota en el contrato (y en su `Payment`, si existe).
        // `depositPaid` no cambia (el contrato sigue firmado o activo); qué significa una fianza
        // devuelta lo decide quien la devolvió.
        const depositContract = isDeposit
          ? await Contract.findById(payment!.contract)
          : await findDepositContract(intentId, charge.metadata);
        if (depositContract) {
          await Contract.updateOne(
            { _id: depositContract._id },
            fullRefund
              ? { $set: { depositAmountRefunded: amountRefunded, depositRefundedAt: refundedAt } }
              : { $set: { depositAmountRefunded: amountRefunded } },
          );
          await recordContractHistory(
            depositContract._id,
            fullRefund ? 'depositRefunded' : 'depositPartiallyRefunded',
            { paymentIntentId: intentId, amountRefunded },
          );
          break;
        }
        console.warn('[stripe] devolución sin pago asociado', { intentId, chargeId: charge.id });
        break;
      }
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed': {
        // Contracargo: se guarda en el pago, el recibo de renta o la fianza y queda en el
        // historial del contrato. Los estados de cobro no cambian; un evento tardío no reabre
        // una disputa ya cerrada.
        const dispute = event.data.object as Stripe.Dispute;
        let intentId = intentIdOf(dispute.payment_intent);
        let chargeMetadata: Stripe.Metadata | null = null;
        if (!intentId || typeof dispute.charge === 'string') {
          const charge =
            typeof dispute.charge === 'string' ? await stripe.charges.retrieve(dispute.charge) : dispute.charge;
          intentId = intentId || intentIdOf(charge?.payment_intent);
          chargeMetadata = charge?.metadata || null;
        } else {
          chargeMetadata = dispute.charge?.metadata || null;
        }
        if (!intentId) {
          console.warn('[stripe] disputa sin PaymentIntent', { disputeId: dispute.id });
          break;
        }
        const info = disputeInfo(dispute, new Date());
        const open = { $nin: CLOSED_DISPUTE_STATUSES };

        const payment = await Payment.findOneAndUpdate(
          { stripePaymentIntentId: intentId, 'dispute.status': open },
          { $set: { dispute: info } },
          { new: true },
        );
        const rentPayment = await RentPayment.findOneAndUpdate(
          { providerPaymentId: intentId, 'dispute.status': open },
          { $set: { dispute: info } },
          { new: true },
        );
        let contractRef = payment?.contract || rentPayment?.contractId;
        let target = 'payment';
        if (payment?.type === 'deposit' && payment.contract) {
          // La ficha del contrato enseña la disputa de la fianza desde `depositDispute`.
          await Contract.updateOne(
            { _id: payment.contract, 'depositDispute.status': open },
            { $set: { depositDispute: info } },
          );
          target = 'deposit';
        }
        if (!payment && !rentPayment) {
          const known =
            (await Payment.exists({ stripePaymentIntentId: intentId })) ||
            (await RentPayment.exists({ providerPaymentId: intentId }));
          if (known) break; // ya cerrada: reenvío o evento tardío
          const depositContract = await findDepositContract(intentId, chargeMetadata);
          if (!depositContract) {
            console.warn('[stripe] disputa sin cobro asociado', { disputeId: dispute.id, intentId });
            break;
          }
          const updated = await Contract.updateOne(
            { _id: depositContract._id, 'depositDispute.status': open },
            { $set: { depositDispute: info } },
          );
          if (!updated.matchedCount) break; // ya cerrada
          contractRef = depositContract._id;
          target = 'deposit';
        }

        console.error('[stripe] disputa', { disputeId: dispute.id, status: dispute.status, intentId, target });
        if (!contractRef) break;
        if (event.type === 'charge.dispute.updated') break;
        await recordContractHistory(
          contractRef,
          event.type === 'charge.dispute.created' ? 'paymentDisputed' : 'paymentDisputeClosed',
          {
            paymentIntentId: intentId,
            disputeId: dispute.id,
            status: dispute.status,
            reason: dispute.reason,
            amount: info.amount,
            target,
            period: rentPayment?.period,
          },
        );
        break;
      }
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.deposit === 'true') {
          const contractId = session.metadata?.contractId;
          const depositIntentId = intentIdOf(session.payment_intent);
          if (contractId && depositIntentId && Types.ObjectId.isValid(contractId)) {
            await Contract.updateOne({ _id: contractId }, { $set: { depositPaymentIntentId: depositIntentId } });
          }
          if (contractId && Types.ObjectId.isValid(contractId)) {
            const contract = await Contract.findById(contractId);
            const paidAt = contract?.depositPaidAt || new Date();
            if (contract && depositIntentId) {
              // Fuera del `if` de abajo: si un intento anterior falló después de marcar la fianza
              // pagada, el reintento de Stripe crea el pago que faltaba.
              await recordDepositPayment(contract, {
                intentId: depositIntentId,
                amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : Number(contract.deposit),
                currency: session.currency || undefined,
                paidAt,
              });
            }
            if (contract && !contract.depositPaid) {
              contract.depositPaid = true;
              contract.depositPaidAt = paidAt;
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
