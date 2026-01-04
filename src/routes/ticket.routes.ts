
import { Router } from 'express';
import Ticket from '../models/ticket.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import Escrow from '../models/escrow.model';
import Pro from '../models/pro.model';
import { User } from '../models/user.model';
import { getUserId } from '../utils/getUserId';
import { ensureDirectConversation } from '../utils/ensureDirectConversation';
import { holdPayment, releasePayment } from '../utils/payment';
import { calcPlatformFee } from '../utils/calcFee';
import PlatformEarning from '../models/platformEarning.model';
import { assertRole } from '../middleware/assertRole';
import { requirePolicies } from '../middleware/requirePolicies';
import type { PolicyType } from '../models/policy.model';

const r = Router();
const REQUIRED_POLICIES: PolicyType[] = ['terms_of_service', 'data_processing'];

function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10));
  return { page, limit };
}

async function publishSystem(conversationId: string, senderId: string, systemCode: string, payload?: any) {
  await Message.create({ conversationId, senderId, type: 'system', systemCode, payload, readBy: [] });
  await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });
}

r.get('/ping', (_req, res) => res.json({ ok: true }));

/** 1) Inquilino abre incidencia */
r.post('/', ...assertRole('tenant'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { contractId, ownerId, propertyId, service, title, description } = req.body || {};
    const t = await Ticket.create({
      contractId,
      ownerId,
      propertyId,
      openedBy: userId,
      service,
      title,
      description,
      status: 'open',
      history: [{ ts: new Date(), actor: userId, action: 'opened' }]
    });
    const direct = await ensureDirectConversation(ownerId, userId);
    if (direct) {
      await publishSystem(direct.id, userId, 'TICKET_OPENED', { ticketId: String(t._id) });
    }
    res.status(201).json(t);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

/** 2) Profesional envía presupuesto */
r.post('/:id/quote', ...assertRole('pro'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { amount } = req.body || {};
    const t = await Ticket.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'not found', code: 404 });

    t.quote = { amount: Number(amount), currency: 'EUR', proId: userId, ts: new Date() };
    t.proId = userId;
    t.status = 'quoted';
    t.history.push({ ts: new Date(), actor: userId, action: 'quoted', payload: { amount: Number(amount) } });
    await t.save();
    res.json(t);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

/** 3) Propietario aprueba → hold (escrow) */
r.post('/:id/approve', ...assertRole('landlord'), requirePolicies(REQUIRED_POLICIES), async (req, res) => {
  try {
    const userId = getUserId(req);
    const t = await Ticket.findById(req.params.id);
    if (!t?.quote) return res.status(400).json({ error: 'quote required', code: 400 });

    const { customerId } = req.body as { customerId?: string };
    if (!customerId) return res.status(400).json({ error: 'customerId (Stripe) is required', code: 400 });

    const pay = await holdPayment({
      customerId,
      amount: t.quote.amount,
      currency: 'eur',
      meta: { ticketId: String(t._id) }
    });

    const esc = await Escrow.create({
      contractId: t.contractId,
      ticketId: String(t._id),
      amount: t.quote.amount,
      currency: 'EUR',
      status: 'held',
      provider: pay.provider,
      paymentRef: pay.ref,
      ledger: [{ ts: new Date(), type: 'hold', payload: pay }]
    });

    t.escrowId = String(esc._id);
    t.status = 'awaiting_schedule';
    t.history.push({ ts: new Date(), actor: userId, action: 'approved_quote', payload: { escrowId: String(esc._id) } });
    await t.save();
    // El canal de cita (pro<->tenant) se abrirá en la primera propuesta
    res.json({ ticket: t, escrow: esc });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

/** 4) Profesional solicita EXTRA */
r.post('/:id/extra', ...assertRole('pro'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { amount, reason } = req.body || {};
    const t = await Ticket.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'not found', code: 404 });

    t.extra = { amount: Number(amount), reason, status: 'pending' };
    t.history.push({ ts: new Date(), actor: userId, action: 'extra_requested', payload: { amount: Number(amount), reason } });
    await t.save();
    res.json(t);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

/** 5) Propietario decide EXTRA */
r.post('/:id/extra/decide', ...assertRole('landlord'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { approve } = req.body || {};
    const t = await Ticket.findById(req.params.id);
    if (!t?.extra) return res.status(400).json({ error: 'no extra pending', code: 400 });

    t.extra.status = approve ? 'approved' : 'rejected';
    t.history.push({ ts: new Date(), actor: userId, action: approve ? 'extra_approved' : 'extra_rejected' });
    await t.save();
    res.json(t);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

/** 6) Profesional completa + factura */
r.post('/:id/complete', ...assertRole('pro'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { invoiceUrl } = req.body || {};
    const t = await Ticket.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'not found', code: 404 });

    t.invoiceUrl = invoiceUrl;
    t.status = 'awaiting_validation';
    t.history.push({ ts: new Date(), actor: userId, action: 'completed', payload: { invoiceUrl } });
    await t.save();
    res.json(t);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

// Pro solicita cierre
r.post('/:id/request-close', ...assertRole('landlord'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const t = await Ticket.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'not found', code: 404 });
    if (t.proId !== userId) return res.status(403).json({ error: 'forbidden', code: 403 });
    t.status = 'awaiting_validation';
    t.history.push({ ts: new Date(), actor: userId, action: 'close_requested' });
    await t.save();
    // publicar en conversación appointment si existe
    const conv = await Conversation.findOne({ kind: 'appointment', 'meta.ticketId': String(t._id) });
    if (conv) await publishSystem(conv.id, userId, 'CLOSE_REQUESTED', { ticketId: String(t._id) });
    res.json(t);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

// Tenant confirma solucionado → release
r.post('/:id/resolve', ...assertRole('tenant'), requirePolicies(REQUIRED_POLICIES), async (req, res) => {
  try {
    const userId = getUserId(req);
    const t = await Ticket.findById(req.params.id);
    if (!t?.escrowId) return res.status(400).json({ error: 'no escrow', code: 400 });
    if (t.openedBy !== userId) return res.status(403).json({ error: 'forbidden', code: 403 });
    const esc = await Escrow.findById(t.escrowId);
    if (!esc) return res.status(404).json({ error: 'escrow not found', code: 404 });

    const gross = (t.quote?.amount ?? 0) + ((t.extra && t.extra.status === 'approved') ? t.extra.amount : 0);
    const breakdown = calcPlatformFee(gross);
    const rel = await releasePayment({ ref: esc.paymentRef!, amount: breakdown.gross, currency: 'eur', fee: breakdown.fee, meta: { ticketId: String(t._id) } });
    esc.status = 'released'; esc.breakdown = breakdown; esc.ledger.push({ ts: new Date(), type: 'release', payload: { ...rel, breakdown } }); await esc.save();
    await PlatformEarning.create({ kind: 'rent', ticketId: String(t._id), escrowId: String(esc._id), gross: breakdown.gross, fee: breakdown.fee, netToPro: breakdown.netToPro, currency: esc.currency || 'EUR', releaseRef: rel.ref, proId: t.proId, serviceKey: t.service });
    t.status = 'closed'; t.history.push({ ts: new Date(), actor: userId, action: 'resolved_by_tenant', payload: breakdown }); await t.save();
    const conv = await Conversation.findOne({ kind: 'appointment', 'meta.ticketId': String(t._id) });
    if (conv) await publishSystem(conv.id, userId, 'CLOSED_BY_TENANT', { ticketId: String(t._id) });
    res.json({ ticket: t, escrow: esc });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

/** 7) Propietario valida → release (escrow + earnings + breakdown) */
r.post('/:id/validate', async (req, res) => {
  try {
    const userId = getUserId(req);
    const t = await Ticket.findById(req.params.id);
    if (!t?.escrowId) return res.status(400).json({ error: 'no escrow', code: 400 });

    const esc = await Escrow.findById(t.escrowId);
    if (!esc) return res.status(404).json({ error: 'escrow not found', code: 404 });

    const gross =
      (t.quote?.amount ?? 0) +
      ((t.extra && t.extra.status === 'approved') ? t.extra.amount : 0);

    const breakdown = calcPlatformFee(gross);

    const rel = await releasePayment({
      ref: esc.paymentRef!,
      amount: breakdown.gross,
      currency: 'eur',
      fee: breakdown.fee,
      meta: { ticketId: String(t._id) }
    });

    esc.status = 'released';
    esc.breakdown = breakdown;
    esc.ledger.push({ ts: new Date(), type: 'release', payload: { ...rel, breakdown } });
    await esc.save();

    await PlatformEarning.create({
      kind: 'rent',
      ticketId: String(t._id),
      escrowId: String(esc._id),
      gross: breakdown.gross,
      fee: breakdown.fee,
      netToPro: breakdown.netToPro,
      currency: esc.currency || 'EUR',
      releaseRef: rel.ref,
      proId: t.proId,
      serviceKey: t.service
    });

    t.status = 'closed';
    t.history.push({ ts: new Date(), actor: userId, action: 'validated_and_released', payload: breakdown });
    await t.save();

    res.json({ ticket: t, escrow: esc });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

/** 8) Asignar profesional a un ticket */
r.post('/:id/assign', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { proId } = req.body || {};
    if (!proId) return res.status(400).json({ error: 'proId required', code: 400 });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'ticket not found', code: 404 });

    const pro = await Pro.findById(proId);
    if (!pro || !pro.active) return res.status(404).json({ error: 'pro not found', code: 404 });

    if (ticket.proId && ticket.proId !== pro.userId) {
      return res.status(409).json({ error: 'ticket already assigned', code: 409 });
    }

    ticket.proId = pro.userId;
    ticket.history.push({ ts: new Date(), actor: userId, action: 'assigned_pro', payload: { proId } });
    await ticket.save();

    res.json({ ticket });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

/** 9) Desasignar profesional */
r.post('/:id/unassign', async (req, res) => {
  try {
    const userId = getUserId(req);
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'ticket not found', code: 404 });
    if (!ticket.proId) return res.status(400).json({ error: 'ticket has no pro assigned', code: 400 });

    ticket.proId = undefined;
    ticket.history.push({ ts: new Date(), actor: userId, action: 'unassigned_pro' });
    await ticket.save();

    res.json({ ticket });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

/** Listados por rol con hidratado de reputación */
r.get('/my/tenant', ...assertRole('tenant'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status } = req.query as any;
    const { page, limit } = parsePagination(req.query);

    const q: any = { openedBy: userId };
    if (status) q.status = status;

    const [items, total] = await Promise.all([
      Ticket.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Ticket.countDocuments(q)
    ]);

    const userIds = new Set<string>();
    const proIds: string[] = [];
    items.forEach(t => {
      userIds.add(t.ownerId);
      userIds.add(t.openedBy);
      if (t.proId) proIds.push(t.proId);
    });

    const [users, pros] = await Promise.all([
      User.find({ _id: { $in: Array.from(userIds) } }, { ratingAvg: 1, reviewCount: 1 }).lean(),
      Pro.find({ userId: { $in: proIds } }, { userId: 1, ratingAvg: 1, reviewCount: 1 }).lean()
    ]);

    const userMap = new Map(users.map(u => [String(u._id), u]));
    const proMap = new Map(pros.map(p => [p.userId, p]));

    const hydrated = items.map(t => ({
      ...t,
      pro: t.proId ? {
        id: t.proId,
        ratingAvg: proMap.get(t.proId)?.ratingAvg ?? 0,
        reviewCount: proMap.get(t.proId)?.reviewCount ?? 0,
      } : null,
      owner: {
        id: t.ownerId,
        ratingAvg: userMap.get(t.ownerId)?.ratingAvg ?? 0,
        reviewCount: userMap.get(t.ownerId)?.reviewCount ?? 0,
      },
      tenant: {
        id: t.openedBy,
        ratingAvg: userMap.get(t.openedBy)?.ratingAvg ?? 0,
        reviewCount: userMap.get(t.openedBy)?.reviewCount ?? 0,
      },
    }));

    res.json({ items: hydrated, total, page, limit });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

r.get('/my/owner', ...assertRole('landlord'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status } = req.query as any;
    const { page, limit } = parsePagination(req.query);

    const q: any = { ownerId: userId };
    if (status) q.status = status;

    const [items, total] = await Promise.all([
      Ticket.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Ticket.countDocuments(q)
    ]);

    const userIds = new Set<string>();
    const proIds: string[] = [];
    items.forEach(t => {
      userIds.add(t.ownerId);
      userIds.add(t.openedBy);
      if (t.proId) proIds.push(t.proId);
    });

    const [users, pros] = await Promise.all([
      User.find({ _id: { $in: Array.from(userIds) } }, { ratingAvg: 1, reviewCount: 1 }).lean(),
      Pro.find({ userId: { $in: proIds } }, { userId: 1, ratingAvg: 1, reviewCount: 1 }).lean()
    ]);

    const userMap = new Map(users.map(u => [String(u._id), u]));
    const proMap = new Map(pros.map(p => [p.userId, p]));

    const hydrated = items.map(t => ({
      ...t,
      pro: t.proId ? {
        id: t.proId,
        ratingAvg: proMap.get(t.proId)?.ratingAvg ?? 0,
        reviewCount: proMap.get(t.proId)?.reviewCount ?? 0,
      } : null,
      owner: {
        id: t.ownerId,
        ratingAvg: userMap.get(t.ownerId)?.ratingAvg ?? 0,
        reviewCount: userMap.get(t.ownerId)?.reviewCount ?? 0,
      },
      tenant: {
        id: t.openedBy,
        ratingAvg: userMap.get(t.openedBy)?.ratingAvg ?? 0,
        reviewCount: userMap.get(t.openedBy)?.reviewCount ?? 0,
      },
    }));

    res.json({ items: hydrated, total, page, limit });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

r.get('/my/pro', ...assertRole('pro'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status } = req.query as any;
    const { page, limit } = parsePagination(req.query);

    const q: any = { proId: userId };
    if (status) q.status = status;

    const [items, total] = await Promise.all([
      Ticket.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Ticket.countDocuments(q)
    ]);

    const userIds = new Set<string>();
    const proIds: string[] = [];
    items.forEach(t => {
      userIds.add(t.ownerId);
      userIds.add(t.openedBy);
      if (t.proId) proIds.push(t.proId);
    });

    const [users, pros] = await Promise.all([
      User.find({ _id: { $in: Array.from(userIds) } }, { ratingAvg: 1, reviewCount: 1 }).lean(),
      Pro.find({ userId: { $in: proIds } }, { userId: 1, ratingAvg: 1, reviewCount: 1 }).lean()
    ]);

    const userMap = new Map(users.map(u => [String(u._id), u]));
    const proMap = new Map(pros.map(p => [p.userId, p]));

    const hydrated = items.map(t => ({
      ...t,
      pro: t.proId ? {
        id: t.proId,
        ratingAvg: proMap.get(t.proId)?.ratingAvg ?? 0,
        reviewCount: proMap.get(t.proId)?.reviewCount ?? 0,
      } : null,
      owner: {
        id: t.ownerId,
        ratingAvg: userMap.get(t.ownerId)?.ratingAvg ?? 0,
        reviewCount: userMap.get(t.ownerId)?.reviewCount ?? 0,
      },
      tenant: {
        id: t.openedBy,
        ratingAvg: userMap.get(t.openedBy)?.ratingAvg ?? 0,
        reviewCount: userMap.get(t.openedBy)?.reviewCount ?? 0,
      },
    }));

    res.json({ items: hydrated, total, page, limit });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
async function publishSystem(conversationId: string, senderId: string, systemCode: string, payload?: any) {
  await Message.create({ conversationId, senderId, type: 'system', systemCode, payload, readBy: [] });
  await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });
}

});

/** Detalle con hidratado */
r.get('/:id', async (req, res) => {
  try {
    const t = await Ticket.findById(req.params.id).lean();
    if (!t) return res.status(404).json({ error: 'not found', code: 404 });

    const userIds = [t.ownerId, t.openedBy];
    const proIds = t.proId ? [t.proId] : [];

    const [users, pros] = await Promise.all([
      User.find({ _id: { $in: userIds } }, { ratingAvg: 1, reviewCount: 1 }).lean(),
      Pro.find({ userId: { $in: proIds } }, { userId: 1, ratingAvg: 1, reviewCount: 1 }).lean()
    ]);

    const userMap = new Map(users.map(u => [String(u._id), u]));
    const proMap = new Map(pros.map(p => [p.userId, p]));

    const result = {
      ...t,
      pro: t.proId ? {
        id: t.proId,
        ratingAvg: proMap.get(t.proId)?.ratingAvg ?? 0,
        reviewCount: proMap.get(t.proId)?.reviewCount ?? 0,
      } : null,
      owner: {
        id: t.ownerId,
        ratingAvg: userMap.get(t.ownerId)?.ratingAvg ?? 0,
        reviewCount: userMap.get(t.ownerId)?.reviewCount ?? 0,
      },
      tenant: {
        id: t.openedBy,
        ratingAvg: userMap.get(t.openedBy)?.ratingAvg ?? 0,
        reviewCount: userMap.get(t.openedBy)?.reviewCount ?? 0,
      },
    };

    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

export default r;
