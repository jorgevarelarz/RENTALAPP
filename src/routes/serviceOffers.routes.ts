import { Router } from 'express';
import mongoose from 'mongoose';
import ServiceOffer from '../models/serviceOffer.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import Appointment from '../models/appointment.model';
import { getUserId } from '../utils/getUserId';
import { calcServiceFee } from '../utils/calcServiceFee';
import { stripe } from '../utils/stripe';
import PlatformEarning from '../models/platformEarning.model';
import { Contract } from '../models/contract.model';
import { User } from '../models/user.model';

const r = Router();

async function publishSystem(conversationId: string, senderId: string, systemCode: string, payload?: any) {
  await Message.create({ conversationId, senderId, type: 'system', systemCode, payload, readBy: [] });
  await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });
}

async function ensureContractConversation(contractId: string): Promise<string> {
  let conv = await Conversation.findOne({ kind: 'contract', refId: contractId });
  if (conv) return conv.id;
  const c = await Contract.findById(contractId).lean();
  if (!c) throw Object.assign(new Error('Contract not found'), { status: 404 });
  conv = await Conversation.create({
    kind: 'contract',
    refId: contractId,
    participants: [String(c.landlord), String(c.tenant)],
    meta: { contractId, ownerId: String(c.landlord), tenantId: String(c.tenant) },
    unread: {},
  });
  return conv.id;
}

r.post('/service-offers', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { conversationId, serviceKey, title, description, amount, currency = 'EUR', ticketId } = req.body || {};
    if (amount <= 0) throw Object.assign(new Error('Invalid amount'), { status: 400 });
    const conv = await Conversation.findById(conversationId);
    if (!conv || conv.kind !== 'ticket') throw Object.assign(new Error('Invalid conversation'), { status: 400 });
    if (conv.meta?.proUserId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
    // limit active offers
    const activeCount = await ServiceOffer.countDocuments({ conversationId, status: { $in: ['proposed', 'accepted', 'scheduled', 'payment_pending'] } });
    if (activeCount >= 5) throw Object.assign(new Error('Too many active offers'), { status: 400 });

    const offer = await ServiceOffer.create({ conversationId, proId: userId, ownerId: conv.meta?.ownerId, propertyId: conv.meta?.propertyId, serviceKey, title, description, amount, currency, status: 'proposed', ticketId });
    await publishSystem(conversationId, userId, 'SERVICE_OFFERED', { offerId: offer.id, amount });
    res.status(201).json(offer);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

r.post('/service-offers/:offerId/decision', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { offerId } = req.params;
    const { accept } = req.body || {};
    const offer = await ServiceOffer.findById(offerId);
    if (!offer) throw Object.assign(new Error('Offer not found'), { status: 404 });
    const conv = await Conversation.findById(offer.conversationId);
    if (!conv) throw Object.assign(new Error('Conversation not found'), { status: 404 });
    if (offer.ownerId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
    offer.status = accept ? 'accepted' : 'rejected';
    await offer.save();
    await publishSystem(offer.conversationId, userId, accept ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED', { offerId });
    if (conv.meta?.contractId) {
      const contractConvId = await ensureContractConversation(conv.meta.contractId);
      await publishSystem(contractConvId, userId, accept ? 'OFFER_ACCEPTED' : 'OFFER_REJECTED', { offerId });
    }
    res.json(offer);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

r.post('/service-offers/:offerId/schedule', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { offerId } = req.params;
    const { start, end, timezone } = req.body || {};
    const offer = await ServiceOffer.findById(offerId);
    if (!offer) throw Object.assign(new Error('Offer not found'), { status: 404 });
    if (offer.proId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
    const conv = await Conversation.findById(offer.conversationId);
    const tenantId = conv?.meta?.tenantId || '';
    let appointment = await Appointment.findOne({ serviceOfferId: offerId });
    if (!appointment) {
      appointment = await Appointment.create({ serviceOfferId: offerId, ticketId: offer.ticketId, proId: offer.proId, tenantId, ownerId: offer.ownerId, start, end, timezone, status: 'scheduled' });
    } else {
      appointment.start = start;
      appointment.end = end;
      appointment.timezone = timezone;
      appointment.status = 'scheduled';
      await appointment.save();
    }
    offer.status = 'scheduled';
    offer.appointmentId = appointment.id;
    await offer.save();
    await publishSystem(offer.conversationId, userId, 'SLOT_PROPOSED', { offerId, start, end });
    if (conv?.meta?.contractId) {
      const contractConvId = await ensureContractConversation(conv.meta.contractId);
      await publishSystem(contractConvId, userId, 'SLOT_PROPOSED', { offerId, start, end });
    }
    res.json({ offer, appointment });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

const STALE_CLAIM_MS = 5 * 60 * 1000;

// El propietario acepta la cita y paga. Aquí solo se crea el cobro: la oferta queda en
// `payment_pending` y es el webhook `payment_intent.succeeded` quien la confirma y
// registra la ganancia, una sola vez.
r.post('/service-offers/:offerId/accept-slot', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { offerId } = req.params;
    const paymentMethod = req.body?.paymentMethod === 'sepa' ? 'sepa_debit' : 'card';
    const offer = await ServiceOffer.findById(offerId);
    if (!offer) throw Object.assign(new Error('Offer not found'), { status: 404 });
    if (offer.ownerId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

    // Ya hay un cobro abierto: se reanuda en lugar de crear otro.
    if (offer.status === 'payment_pending' && offer.paymentIntentId) {
      const current = await stripe.paymentIntents.retrieve(offer.paymentIntentId);
      if (current.status !== 'canceled') {
        return res.json({ offer, paymentIntent: { id: current.id, client_secret: current.client_secret, status: current.status } });
      }
    }
    const resumable = offer.status === 'scheduled' || offer.status === 'payment_pending';
    if (!resumable) throw Object.assign(new Error('Offer is not awaiting payment'), { status: 409 });

    const fee = calcServiceFee(offer.amount);
    const pro = await User.findById(offer.proId).lean();
    const destination = pro?.stripeAccountId;
    if (!destination) throw Object.assign(new Error('Pro missing stripe account'), { status: 400 });
    const owner = mongoose.isValidObjectId(userId) ? await User.findById(userId).select('stripeCustomerId').lean() : null;

    // Reclamo atómico: solo una petición pasa de `scheduled` a `payment_pending`.
    // Un intento cancelado o un reclamo abandonado (sin intento) se pueden retomar.
    const claimed = await ServiceOffer.findOneAndUpdate(
      {
        _id: offer._id,
        ownerId: userId,
        $or: [
          { status: 'scheduled' },
          { status: 'payment_pending', paymentIntentId: offer.paymentIntentId || '__none__' },
          { status: 'payment_pending', paymentIntentId: null, updatedAt: { $lt: new Date(Date.now() - STALE_CLAIM_MS) } },
        ],
      },
      { $set: { status: 'payment_pending' }, $unset: { paymentIntentId: 1 } },
      { new: true },
    );
    if (!claimed) throw Object.assign(new Error('Payment already in progress'), { status: 409 });

    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(offer.amount * 100),
        currency: offer.currency,
        payment_method_types: [paymentMethod],
        ...(owner?.stripeCustomerId ? { customer: owner.stripeCustomerId } : {}),
        application_fee_amount: Math.round(fee.fee * 100),
        transfer_data: { destination },
        metadata: { offerId: offer.id },
      });
    } catch (err) {
      await ServiceOffer.updateOne({ _id: offer._id, status: 'payment_pending', paymentIntentId: null }, { status: 'scheduled' });
      throw err;
    }
    claimed.paymentIntentId = paymentIntent.id;
    await claimed.save();
    res.json({
      offer: claimed,
      paymentIntent: { id: paymentIntent.id, client_secret: paymentIntent.client_secret, status: paymentIntent.status },
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

r.post('/appointments/:id/reschedule', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const { start, end, timezone } = req.body || {};
    const a = await Appointment.findById(id);
    if (!a) throw Object.assign(new Error('Appointment not found'), { status: 404 });
    if (![a.proId, a.tenantId, a.ownerId].includes(userId)) throw Object.assign(new Error('Forbidden'), { status: 403 });
    a.start = start;
    a.end = end;
    a.timezone = timezone;
    a.status = 'rescheduled';
    await a.save();
    const conv = await Conversation.findOne({ kind: 'appointment', refId: id });
    if (conv) {
      await publishSystem(conv.id, userId, 'APPOINTMENT_RESCHEDULED', { id, start, end });
    }
    if (a.ticketId) {
      const ticketConv = await Conversation.findOne({ kind: 'ticket', refId: a.ticketId });
      if (ticketConv?.meta?.contractId) {
        const contractConvId = await ensureContractConversation(ticketConv.meta.contractId);
        await publishSystem(contractConvId, userId, 'APPOINTMENT_RESCHEDULED', { id, start, end });
      }
    }
    res.json(a);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

r.post('/appointments/:id/cancel', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;
    const a = await Appointment.findById(id);
    if (!a) throw Object.assign(new Error('Appointment not found'), { status: 404 });
    if (![a.proId, a.tenantId, a.ownerId].includes(userId)) throw Object.assign(new Error('Forbidden'), { status: 403 });
    a.status = 'cancelled';
    await a.save();
    const conv = await Conversation.findOne({ kind: 'appointment', refId: id });
    if (conv) {
      await publishSystem(conv.id, userId, 'APPOINTMENT_CANCELLED', { id });
    }
    if (a.ticketId) {
      const ticketConv = await Conversation.findOne({ kind: 'ticket', refId: a.ticketId });
      if (ticketConv?.meta?.contractId) {
        const contractConvId = await ensureContractConversation(ticketConv.meta.contractId);
        await publishSystem(contractConvId, userId, 'APPOINTMENT_CANCELLED', { id });
      }
    }
    res.json(a);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

r.post('/service-offers/:offerId/complete', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { offerId } = req.params;
    const { invoiceUrl } = req.body || {};
    const offer = await ServiceOffer.findById(offerId);
    if (!offer) throw Object.assign(new Error('Offer not found'), { status: 404 });
    if (offer.proId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
    offer.status = 'done';
    if (invoiceUrl) (offer as any).invoiceUrl = invoiceUrl;
    await offer.save();
    await publishSystem(offer.conversationId, userId, 'SERVICE_DONE', { offerId, invoiceUrl });
    res.json(offer);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default r;
