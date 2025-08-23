import { Router } from 'express';
import Ticket from '../models/ticket.model';
import Escrow from '../models/escrow.model';
import Pro from '../models/pro.model';
import { getUserId } from '../utils/getUserId';
import { holdPayment, releasePayment } from '../utils/payment';

const r = Router();

function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10));
  return { page, limit };
}

r.get('/ping', (_req, res) => res.json({ ok: true }));

// 1) Inquilino abre incidencia
r.post('/', async (req, res) => {
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
    res.status(201).json(t);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

// 2) Profesional envía presupuesto
r.post('/:id/quote', async (req, res) => {
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

// 3) Propietario aprueba → hold (escrow)
r.post('/:id/approve', async (req, res) => {
  try {
    const userId = getUserId(req);
    const t = await Ticket.findById(req.params.id);
    if (!t?.quote) return res.status(400).json({ error: 'quote required', code: 400 });
    const { customerId } = req.body as { customerId?: string };
    if (!customerId) return res.status(400).json({ error: 'customerId (Stripe) is required', code: 400 });

    const pay = await holdPayment({ customerId, amount: t.quote.amount, currency: 'eur', meta: { ticketId: String(t._id) } });

    const esc = await Escrow.create({
      contractId: t.contractId, ticketId: String(t._id), amount: t.quote.amount,
      currency: 'EUR', status: 'held', provider: pay.provider, paymentRef: pay.ref,
      ledger: [{ ts: new Date(), type: 'hold', payload: pay }]
    });

    t.escrowId = String(esc._id);
    t.status = 'in_progress';
    t.history.push({ ts: new Date(), actor: userId, action: 'approved_quote', payload: { escrowId: String(esc._id) } });
    await t.save();
    res.json({ ticket: t, escrow: esc });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

// 4) Profesional solicita EXTRA
r.post('/:id/extra', async (req, res) => {
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

// 5) Propietario decide EXTRA
r.post('/:id/extra/decide', async (req, res) => {
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

// 6) Profesional completa + factura
r.post('/:id/complete', async (req, res) => {
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

// 7) Propietario valida → release (escrow)
r.post('/:id/validate', async (req, res) => {
  try {
    const userId = getUserId(req);
    const t = await Ticket.findById(req.params.id);
    if (!t?.escrowId) return res.status(400).json({ error: 'no escrow', code: 400 });
    const esc = await Escrow.findById(t.escrowId);
    if (!esc) return res.status(404).json({ error: 'escrow not found', code: 404 });

    const total = (t.quote?.amount ?? 0) + ((t.extra && t.extra.status === 'approved') ? t.extra.amount : 0);
    await releasePayment({ ref: esc.paymentRef!, amount: total, currency: 'eur' });

    esc.status = 'released';
    esc.ledger.push({ ts: new Date(), type: 'release', payload: { amount: total } });
    await esc.save();

    t.status = 'closed';
    t.history.push({ ts: new Date(), actor: userId, action: 'validated_and_released', payload: { total } });
    await t.save();

    res.json({ ticket: t, escrow: esc });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

// 8) Asignar profesional a un ticket
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

// 9) Desasignar profesional
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

// Listados de tickets por rol
r.get('/my/tenant', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status } = req.query as any;
    const { page, limit } = parsePagination(req.query);
    const q: any = { openedBy: userId };
    if (status) q.status = status;
    const [items, total] = await Promise.all([
      Ticket.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Ticket.countDocuments(q)
    ]);
    res.json({ items, total, page, limit });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

r.get('/my/owner', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status } = req.query as any;
    const { page, limit } = parsePagination(req.query);
    const q: any = { ownerId: userId };
    if (status) q.status = status;
    const [items, total] = await Promise.all([
      Ticket.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Ticket.countDocuments(q)
    ]);
    res.json({ items, total, page, limit });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

r.get('/my/pro', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { status } = req.query as any;
    const { page, limit } = parsePagination(req.query);
    const q: any = { proId: userId };
    if (status) q.status = status;
    const [items, total] = await Promise.all([
      Ticket.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Ticket.countDocuments(q)
    ]);
    res.json({ items, total, page, limit });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message, code: err.status || 500 });
  }
});

export default r;
