import { Router } from 'express';
import Ticket from '../models/ticket.model';
import Escrow from '../models/escrow.model';
import { getUserId } from '../utils/getUserId';
import { holdPayment, releasePayment } from '../utils/payment';
const r = Router();

r.get('/ping', (_req, res) => res.json({ ok: true }));

// 1) Inquilino abre incidencia
r.post('/', async (req, res) => {
  const userId = getUserId(req);
  const { contractId, ownerId, propertyId, service, title, description } = req.body || {};
  const t = await Ticket.create({
    contractId, ownerId, propertyId, openedBy: userId, service, title, description,
    status: 'open', history: [{ ts: new Date(), actor: userId, action: 'opened' }]
  });
  res.status(201).json(t);
});

// 2) Profesional envía presupuesto
r.post('/:id/quote', async (req, res) => {
  const userId = getUserId(req);
  const { amount } = req.body || {};
  const t = await Ticket.findById(req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  t.quote = { amount: Number(amount), currency: 'EUR', proId: userId, ts: new Date() };
  t.proId = userId; t.status = 'quoted';
  t.history.push({ ts: new Date(), actor: userId, action: 'quoted', payload: { amount: Number(amount) } });
  await t.save();
  res.json(t);
});

// 3) Propietario aprueba → hold (escrow)
r.post('/:id/approve', async (req, res) => {
  const userId = getUserId(req);
  const t = await Ticket.findById(req.params.id);
  if (!t?.quote) return res.status(400).json({ error: 'quote required' });
  const { customerId } = req.body as { customerId?: string };
  if (!customerId) return res.status(400).json({ error: 'customerId (Stripe) is required' });

  const pay = await holdPayment({ customerId, amount: t.quote.amount, currency: 'eur', meta: { ticketId: String(t._id) } });

  const esc = await Escrow.create({
    contractId: t.contractId, ticketId: String(t._id), amount: t.quote.amount,
    currency: 'EUR', status: 'held', provider: pay.provider, paymentRef: pay.ref,
    ledger: [{ ts: new Date(), type: 'hold', payload: pay }]
  });

  t.escrowId = String(esc._id); t.status = 'in_progress';
  t.history.push({ ts: new Date(), actor: userId, action: 'approved_quote', payload: { escrowId: String(esc._id) } });
  await t.save();
  res.json({ ticket: t, escrow: esc });
});

// 4) Profesional solicita EXTRA
r.post('/:id/extra', async (req, res) => {
  const userId = getUserId(req);
  const { amount, reason } = req.body || {};
  const t = await Ticket.findById(req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  t.extra = { amount: Number(amount), reason, status: 'pending' };
  t.history.push({ ts: new Date(), actor: userId, action: 'extra_requested', payload: { amount: Number(amount), reason } });
  await t.save();
  res.json(t);
});

// 5) Propietario decide EXTRA
r.post('/:id/extra/decide', async (req, res) => {
  const userId = getUserId(req);
  const { approve } = req.body || {};
  const t = await Ticket.findById(req.params.id);
  if (!t?.extra) return res.status(400).json({ error: 'no extra pending' });
  t.extra.status = approve ? 'approved' : 'rejected';
  t.history.push({ ts: new Date(), actor: userId, action: approve ? 'extra_approved' : 'extra_rejected' });
  await t.save();
  res.json(t);
});

// 6) Profesional completa + factura
r.post('/:id/complete', async (req, res) => {
  const userId = getUserId(req);
  const { invoiceUrl } = req.body || {};
  const t = await Ticket.findById(req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  t.invoiceUrl = invoiceUrl;
  t.status = 'awaiting_validation';
  t.history.push({ ts: new Date(), actor: userId, action: 'completed', payload: { invoiceUrl } });
  await t.save();
  res.json(t);
});

// 7) Propietario valida → release (escrow)
r.post('/:id/validate', async (req, res) => {
  const userId = getUserId(req);
  const t = await Ticket.findById(req.params.id);
  if (!t?.escrowId) return res.status(400).json({ error: 'no escrow' });
  const esc = await Escrow.findById(t.escrowId);
  if (!esc) return res.status(404).json({ error: 'escrow not found' });

  const total = (t.quote?.amount ?? 0) + ((t.extra && t.extra.status === 'approved') ? t.extra.amount : 0);
  await releasePayment({ ref: esc.paymentRef!, amount: total, currency: 'eur' });

  esc.status = 'released';
  esc.ledger.push({ ts: new Date(), type: 'release', payload: { amount: total } });
  await esc.save();

  t.status = 'closed';
  t.history.push({ ts: new Date(), actor: userId, action: 'validated_and_released', payload: { total } });
  await t.save();

  res.json({ ticket: t, escrow: esc });
});

export default r;
