
import { Router } from 'express';
import { Types } from 'mongoose';
import Ticket from '../models/ticket.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import Escrow from '../models/escrow.model';
import Appointment from '../models/appointment.model';
import Pro from '../models/pro.model';
import { User } from '../models/user.model';
import { Contract } from '../models/contract.model';
import { getUserId } from '../utils/getUserId';
import Review from '../models/review.model';
import { ensureDirectConversation } from '../utils/ensureDirectConversation';
import { holdPayment } from '../utils/payment';
import { releaseTicketEscrow } from '../services/ticketEscrow.service';
import { assertRole } from '../middleware/assertRole';
import { requirePolicies } from '../middleware/requirePolicies';
import type { PolicyType } from '../models/policy.model';
import type { ProService } from '../models/pro.model';
import { Property } from '../models/property.model';
import { sendTicketOpenedEmail } from '../utils/email';
import { logger } from '../utils/logger';
import { isOwnUploadUrl } from '../utils/uploadUrl';
import { csvRow } from '../utils/csv';
import { sendRouteError } from '../utils/routeError';

const r = Router();
const REQUIRED_POLICIES: PolicyType[] = ['terms_of_service', 'data_processing'];
/** Estados en los que el profesional trabaja: pagado el presupuesto y aún sin dar por terminado. */
const WORK_STATUSES = ['awaiting_schedule', 'scheduled', 'in_progress'];

function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 10));
  return { page, limit };
}

async function publishSystem(conversationId: string, senderId: string, systemCode: string, payload?: any) {
  await Message.create({ conversationId, senderId, type: 'system', systemCode, payload, readBy: [] });
  await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });
}

/** Fotos por avería: las mismas que admite una subida de /api/uploads/images. */
const PHOTOS_MAX = 6;

/** Servicios que se pueden pedir: los mismos que ofrecen los profesionales (pro.model). */
const TICKET_SERVICES: ProService[] = ['plumbing', 'electricity', 'appliances', 'locksmith', 'cleaning', 'painting', 'others'];
const SERVICE_LABELS: Record<ProService, string> = {
  plumbing: 'Fontanería',
  electricity: 'Electricidad',
  appliances: 'Electrodomésticos',
  locksmith: 'Cerrajería',
  cleaning: 'Limpieza',
  painting: 'Pintura',
  others: 'Otros',
};
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

async function notifyOwnerTicketOpened(t: any, ownerId: string, tenantId: string, propertyId: string) {
  const [owner, tenant, property] = await Promise.all([
    User.findById(ownerId).select('email').lean(),
    User.findById(tenantId).select('name').lean(),
    Property.findById(propertyId).select('title address city').lean(),
  ]);
  const to = (owner as any)?.email;
  if (!to) return;
  const p = property as any;
  await sendTicketOpenedEmail(to, {
    ticketId: String(t._id),
    title: t.title,
    serviceLabel: SERVICE_LABELS[t.service as ProService] || t.service,
    description: t.description,
    photoCount: t.photos?.length || 0,
    tenantName: (tenant as any)?.name,
    propertyTitle: p?.title,
    propertyAddress: [p?.address, p?.city].filter(Boolean).join(', ') || undefined,
  });
}

type TicketParty = 'owner' | 'tenant' | 'pro';

/** Carga el ticket y responde 404/403 si quien llama no es una de las partes indicadas. */
async function loadTicketFor(req: any, res: any, parties: TicketParty[], opts: { allowAdmin?: boolean } = {}) {
  const userId = getUserId(req);
  // Un id mal formado es una incidencia que no existe (antes, 500 con el mensaje de Mongoose)
  const t = Types.ObjectId.isValid(req.params.id) ? await Ticket.findById(req.params.id) : null;
  if (!t) {
    res.status(404).json({ error: 'not found', code: 404 });
    return null;
  }
  const isAdmin = opts.allowAdmin && req.user?.role === 'admin';
  const allowed =
    isAdmin ||
    (parties.includes('owner') && t.ownerId === userId) ||
    (parties.includes('tenant') && t.openedBy === userId) ||
    (parties.includes('pro') && !!t.proId && t.proId === userId);
  if (!allowed) {
    res.status(403).json({ error: 'forbidden', code: 403 });
    return null;
  }
  return t;
}

r.get('/ping', (_req, res) => res.json({ ok: true }));

/** 1) Inquilino abre incidencia */
r.post('/', ...assertRole('tenant'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { contractId, service } = req.body || {};
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    if (typeof service !== 'string' || !TICKET_SERVICES.includes(service as ProService)) {
      return res.status(400).json({ error: 'invalid_service', code: 400 });
    }
    if (!title || title.length > TITLE_MAX) return res.status(400).json({ error: 'invalid_title', code: 400 });
    if (!description || description.length > DESCRIPTION_MAX) {
      return res.status(400).json({ error: 'invalid_description', code: 400 });
    }
    // Fotos opcionales, solo ficheros subidos a nuestro /uploads (nada de URLs ajenas)
    const rawPhotos = req.body?.photos ?? [];
    if (!Array.isArray(rawPhotos) || rawPhotos.length > PHOTOS_MAX
      || !rawPhotos.every((u: unknown) => typeof u === 'string' && isOwnUploadUrl(u))) {
      return res.status(400).json({ error: 'invalid_photos', code: 400 });
    }
    const photos = Array.from(new Set(rawPhotos as string[]));
    // Propietario e inmueble salen del contrato del inquilino, nunca del body
    const contract = contractId ? await Contract.findById(String(contractId)).select('tenant landlord property status').lean() : null;
    if (!contract || String(contract.tenant) !== userId) {
      return res.status(403).json({ error: 'contract_not_owned', code: 403 });
    }
    if (contract.status !== 'active') return res.status(409).json({ error: 'contract_not_active', code: 409 });
    const ownerId = String(contract.landlord);
    const propertyId = String(contract.property);
    const t = await Ticket.create({
      contractId: String(contractId),
      ownerId,
      propertyId,
      openedBy: userId,
      service,
      title,
      description,
      ...(photos.length ? { photos } : {}),
      status: 'open',
      history: [{ ts: new Date(), actor: userId, action: 'opened' }]
    });
    const direct = await ensureDirectConversation(ownerId, userId);
    if (direct) {
      await publishSystem(direct.id, userId, 'TICKET_OPENED', { ticketId: String(t._id) });
    }
    res.status(201).json(t);
    // El aviso por correo no retrasa ni tumba la respuesta: deliverEmail no lanza
    notifyOwnerTicketOpened(t, ownerId, userId, propertyId).catch(err =>
      logger.error({ type: 'ticket_owner_notify_error', ticketId: String(t._id), err }, 'Aviso de avería no enviado'),
    );
  } catch (err: any) {
    sendRouteError(res, err, 'ticket_request_failed');
  }
});

/** 2) Profesional envía presupuesto */
r.post('/:id/quote', ...assertRole('pro'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { amount } = req.body || {};
    // Solo presupuesta el profesional que el propietario ha seleccionado (/assign), y antes del hold
    const t = await loadTicketFor(req, res, ['pro']);
    if (!t) return;
    if (t.escrowId) return res.status(409).json({ error: 'quote_locked', code: 409 });
    if (!(Number(amount) > 0)) return res.status(400).json({ error: 'invalid amount', code: 400 });

    t.quote = { amount: Number(amount), currency: 'EUR', proId: userId, ts: new Date() };
    t.proId = userId;
    t.status = 'quoted';
    t.history.push({ ts: new Date(), actor: userId, action: 'quoted', payload: { amount: Number(amount) } });
    await t.save();
    res.json(t);
  } catch (err: any) {
    sendRouteError(res, err, 'ticket_request_failed');
  }
});

/** 3) Propietario aprueba → hold (escrow) */
r.post('/:id/approve', ...assertRole('landlord'), requirePolicies(REQUIRED_POLICIES), async (req, res) => {
  try {
    const userId = getUserId(req);
    const t = await loadTicketFor(req, res, ['owner']);
    if (!t) return;
    if (!t.quote) return res.status(400).json({ error: 'quote required', code: 400 });
    if (t.escrowId) return res.status(409).json({ error: 'already approved', code: 409 });

    // El cargo va contra el cliente Stripe del propietario autenticado, no contra uno del body.
    // Con el driver mock (bloqueado en producción por env.ts) se admite el del body para pruebas.
    const owner = await User.findById(userId).select('stripeCustomerId').lean();
    const isMockEscrow = (process.env.ESCROW_DRIVER || 'mock').toLowerCase() === 'mock';
    const customerId = (owner as any)?.stripeCustomerId || (isMockEscrow ? (req.body as any)?.customerId : undefined);
    if (!customerId) return res.status(409).json({ error: 'owner_no_stripe_customer', code: 409 });

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
    sendRouteError(res, err, 'ticket_request_failed');
  }
});

/** 4) Profesional solicita EXTRA */
r.post('/:id/extra', ...assertRole('pro'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { amount, reason } = req.body || {};
    const t = await loadTicketFor(req, res, ['pro']);
    if (!t) return;
    if (!(Number(amount) > 0)) return res.status(400).json({ error: 'invalid amount', code: 400 });

    t.extra = { amount: Number(amount), reason, status: 'pending' };
    t.history.push({ ts: new Date(), actor: userId, action: 'extra_requested', payload: { amount: Number(amount), reason } });
    await t.save();
    res.json(t);
  } catch (err: any) {
    sendRouteError(res, err, 'ticket_request_failed');
  }
});

/** 5) Propietario decide EXTRA */
r.post('/:id/extra/decide', ...assertRole('landlord'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { approve } = req.body || {};
    const t = await loadTicketFor(req, res, ['owner']);
    if (!t) return;
    if (!t.extra || t.extra.status !== 'pending') return res.status(400).json({ error: 'no extra pending', code: 400 });

    t.extra.status = approve ? 'approved' : 'rejected';
    t.history.push({ ts: new Date(), actor: userId, action: approve ? 'extra_approved' : 'extra_rejected' });
    await t.save();
    res.json(t);
  } catch (err: any) {
    sendRouteError(res, err, 'ticket_request_failed');
  }
});

/** 6) Profesional completa + factura */
r.post('/:id/complete', ...assertRole('pro'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { invoiceUrl } = req.body || {};
    const t = await loadTicketFor(req, res, ['pro']);
    if (!t) return;
    // Solo se completa un trabajo ya pagado (hold) y que no esté pendiente de validar o cerrado
    if (!t.escrowId) return res.status(409).json({ error: 'quote_not_approved', code: 409 });
    if (!WORK_STATUSES.includes(t.status)) return res.status(409).json({ error: 'invalid_status', code: 409 });

    t.invoiceUrl = invoiceUrl;
    t.status = 'awaiting_validation';
    t.history.push({ ts: new Date(), actor: userId, action: 'completed', payload: { invoiceUrl } });
    await t.save();
    res.json(t);
  } catch (err: any) {
    sendRouteError(res, err, 'ticket_request_failed');
  }
});

// Pro solicita cierre
r.post('/:id/request-close', ...assertRole('pro'), async (req, res) => {
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
    sendRouteError(res, err, 'ticket_request_failed');
  }
});

// Tenant confirma solucionado → release
r.post('/:id/resolve', ...assertRole('tenant'), requirePolicies(REQUIRED_POLICIES), async (req, res) => {
  try {
    const userId = getUserId(req);
    const t = await loadTicketFor(req, res, ['tenant']);
    if (!t) return;
    if (!t.escrowId) return res.status(400).json({ error: 'no escrow', code: 400 });
    // Igual que /validate: no se libera el pago al profesional antes de que dé el trabajo por hecho
    if (t.status !== 'awaiting_validation') return res.status(409).json({ error: 'work_not_completed', code: 409 });
    const { ticket, escrow } = await releaseTicketEscrow(String(t._id), userId, 'resolved_by_tenant');
    const conv = await Conversation.findOne({ kind: 'appointment', 'meta.ticketId': String(t._id) });
    if (conv) await publishSystem(conv.id, userId, 'CLOSED_BY_TENANT', { ticketId: String(t._id) });
    res.json({ ticket, escrow });
  } catch (err: any) {
    sendRouteError(res, err, 'ticket_request_failed');
  }
});

/** 7) Propietario valida → release (escrow + earnings + breakdown) */
r.post('/:id/validate', ...assertRole('landlord'), requirePolicies(REQUIRED_POLICIES), async (req, res) => {
  try {
    const userId = getUserId(req);
    const t = await loadTicketFor(req, res, ['owner']);
    if (!t) return;
    if (!t.escrowId) return res.status(400).json({ error: 'no escrow', code: 400 });
    if (t.status !== 'awaiting_validation') return res.status(409).json({ error: 'work_not_completed', code: 409 });
    const { ticket, escrow } = await releaseTicketEscrow(String(t._id), userId, 'validated_and_released');
    res.json({ ticket, escrow });
  } catch (err: any) {
    sendRouteError(res, err, 'ticket_request_failed');
  }
});

/** 8) Asignar profesional a un ticket */
r.post('/:id/assign', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { proId } = req.body || {};
    if (!proId) return res.status(400).json({ error: 'proId required', code: 400 });
    if (typeof proId !== 'string') return res.status(400).json({ error: 'invalid_pro', code: 400 });

    const ticket = await loadTicketFor(req, res, ['owner'], { allowAdmin: true });
    if (!ticket) return;
    if (ticket.escrowId) return res.status(409).json({ error: 'ticket already approved', code: 409 });

    const pro = Types.ObjectId.isValid(proId) ? await Pro.findById(proId) : null;
    if (!pro || !pro.active) return res.status(404).json({ error: 'pro not found', code: 404 });
    // Solo cuentas de profesional: los perfiles que crearon otros roles antes de la ronda 44 no se asignan
    const proUser = await User.findById(pro.userId).select('role').lean();
    if ((proUser as any)?.role !== 'pro') return res.status(404).json({ error: 'pro not found', code: 404 });

    if (ticket.proId && ticket.proId !== pro.userId) {
      return res.status(409).json({ error: 'ticket already assigned', code: 409 });
    }

    ticket.proId = pro.userId;
    ticket.history.push({ ts: new Date(), actor: userId, action: 'assigned_pro', payload: { proId } });
    await ticket.save();

    res.json({ ticket });
  } catch (err: any) {
    sendRouteError(res, err, 'ticket_request_failed');
  }
});

/** 9) Desasignar profesional */
r.post('/:id/unassign', async (req, res) => {
  try {
    const userId = getUserId(req);
    const ticket = await loadTicketFor(req, res, ['owner'], { allowAdmin: true });
    if (!ticket) return;
    if (ticket.escrowId) return res.status(409).json({ error: 'ticket already approved', code: 409 });
    if (!ticket.proId) return res.status(400).json({ error: 'ticket has no pro assigned', code: 400 });

    ticket.proId = undefined;
    ticket.history.push({ ts: new Date(), actor: userId, action: 'unassigned_pro' });
    await ticket.save();

    res.json({ ticket });
  } catch (err: any) {
    sendRouteError(res, err, 'ticket_request_failed');
  }
});

/** Estados por los que se puede filtrar el listado. */
const TICKET_STATUSES = ['open', 'quoted', 'in_progress', 'awaiting_schedule', 'scheduled', 'awaiting_validation', 'closed', 'disputed'];
const SEARCH_MAX = 100;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Filtro del listado: estado validado (400 invalid_status) y búsqueda por título
 * o por el nombre del servicio en español («fontaneria» encuentra plumbing).
 */
function buildListFilter(base: Record<string, string>, query: any): { filter?: any; error?: string } {
  const filter: any = { ...base };
  const { status, q } = query;
  if (status !== undefined && status !== '') {
    // Uno o varios estados separados por comas («awaiting_validation,closed»).
    if (typeof status !== 'string') return { error: 'invalid_status' };
    const statuses = Array.from(new Set(status.split(',').map(s => s.trim())));
    if (!statuses.every(s => TICKET_STATUSES.includes(s))) return { error: 'invalid_status' };
    filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }
  if (q !== undefined && typeof q !== 'string') return { error: 'invalid_query' };
  const term = (q || '').trim().slice(0, SEARCH_MAX);
  if (term) {
    const folded = fold(term);
    const services = TICKET_SERVICES.filter(s => fold(SERVICE_LABELS[s]).includes(folded));
    filter.$or = [
      { title: { $regex: escapeRegExp(term), $options: 'i' } },
      ...(services.length ? [{ service: { $in: services } }] : []),
    ];
  }
  return { filter };
}

/** Listado de las incidencias de quien llama (como inquilino, propietario o profesional), con reputación. */
function listMine(field: 'openedBy' | 'ownerId' | 'proId') {
  return async (req: any, res: any) => {
    try {
      const userId = getUserId(req);
      const { page, limit } = parsePagination(req.query);
      const { filter: q, error } = buildListFilter({ [field]: userId }, req.query);
      if (error) return res.status(400).json({ error, code: 400 });

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
      sendRouteError(res, err, 'ticket_request_failed');
    }
  };
}

/** Estados con el presupuesto aprobado y pagado: lo que el profesional puede facturar. */
const PRO_BILLABLE_STATUSES = [...WORK_STATUSES, 'awaiting_validation', 'closed'];
const PRO_BILLING_CSV_MAX = 5000;
const STATUS_LABELS: Record<string, string> = {
  open: 'Abierta',
  quoted: 'Presupuestada',
  awaiting_schedule: 'Por agendar',
  scheduled: 'Agendada',
  in_progress: 'En curso',
  awaiting_validation: 'Por validar',
  closed: 'Cerrada',
  disputed: 'En disputa',
};

/** Presupuesto más el extra aprobado: lo que se libera al profesional (releaseTicketEscrow). */
const billableAmountExpr = {
  $add: [
    { $ifNull: ['$quote.amount', 0] },
    { $cond: [{ $eq: ['$extra.status', 'approved'] }, { $ifNull: ['$extra.amount', 0] }, 0] },
  ],
};

/** Resumen del profesional, calculado sobre todas sus incidencias (no solo la página cargada). */
r.get('/my/pro/summary', ...assertRole('pro'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const rows = await Ticket.aggregate([
      { $match: { proId: userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          quoted: { $sum: { $ifNull: ['$quote.amount', 0] } },
          billable: { $sum: billableAmountExpr },
        },
      },
    ]);
    const byStatus = new Map(rows.map(row => [String(row._id), row]));
    const sum = (statuses: string[], key: 'count' | 'quoted' | 'billable') =>
      statuses.reduce((acc, s) => acc + Number(byStatus.get(s)?.[key] || 0), 0);
    const pendingStatuses = PRO_BILLABLE_STATUSES.filter(s => s !== 'closed');
    res.json({
      quotes: {
        toQuote: sum(['open'], 'count'),
        awaitingApproval: sum(['quoted'], 'count'),
        approved: sum(PRO_BILLABLE_STATUSES, 'count'),
        quotedTotal: rows.reduce((acc, row) => acc + Number(row.quoted || 0), 0),
      },
      // Lo que le toca mover al profesional, para su inicio.
      work: {
        toSchedule: sum(['awaiting_schedule'], 'count'),
        inProgress: sum(['scheduled', 'in_progress'], 'count'),
        awaitingValidation: sum(['awaiting_validation'], 'count'),
      },
      billing: {
        pendingCount: sum(pendingStatuses, 'count'),
        pendingTotal: sum(pendingStatuses, 'billable'),
        releasedCount: sum(['closed'], 'count'),
        releasedTotal: sum(['closed'], 'billable'),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'pro summary failed');
    res.status(500).json({ error: 'summary_failed', code: 500 });
  }
});

/** CSV de los trabajos facturables del profesional (todos, no solo la página cargada). */
r.get('/my/pro/billing.csv', ...assertRole('pro'), async (req, res) => {
  try {
    const userId = getUserId(req);
    const items = await Ticket.find({ proId: userId, status: { $in: PRO_BILLABLE_STATUSES } })
      .sort({ updatedAt: -1 })
      .limit(PRO_BILLING_CSV_MAX)
      .select('title service status quote extra updatedAt')
      .lean();
    const money = (n: number) => n.toFixed(2);
    const lines = items.map((t: any) => {
      const quote = Number(t.quote?.amount || 0);
      const extra = t.extra?.status === 'approved' ? Number(t.extra?.amount || 0) : 0;
      return csvRow([
        t.updatedAt ? new Date(t.updatedAt).toISOString().slice(0, 10) : '',
        t.title,
        SERVICE_LABELS[t.service as ProService] || t.service || '',
        STATUS_LABELS[t.status] || t.status,
        money(quote),
        money(extra),
        money(quote + extra),
        String(t._id),
      ]);
    });
    const csv = ['Fecha,Trabajo,Servicio,Estado,Presupuesto (EUR),Extra aprobado (EUR),Total (EUR),Referencia', ...lines].join('\n');
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`rentalapp_facturacion_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(`\uFEFF${csv}\n`);
  } catch (err: any) {
    logger.error({ err }, 'pro billing csv failed');
    res.status(500).json({ error: 'billing_csv_failed', code: 500 });
  }
});

r.get('/my/tenant', ...assertRole('tenant'), listMine('openedBy'));
r.get('/my/owner', ...assertRole('landlord'), listMine('ownerId'));
r.get('/my/pro', ...assertRole('pro'), listMine('proId'));

/** Detalle con hidratado */
r.get('/:id', async (req, res) => {
  try {
    const doc = await loadTicketFor(req, res, ['owner', 'tenant', 'pro'], { allowAdmin: true });
    if (!doc) return;
    const t = doc.toObject() as any;

    const userIds = [t.ownerId, t.openedBy];
    const proIds = t.proId ? [t.proId] : [];

    // Quien abrió la incidencia o el propietario valoran al profesional cuando se cierra
    const userId = getUserId(req);
    const reviewer = t.status === 'closed' && t.proId && (userId === t.ownerId || userId === t.openedBy);

    const [users, pros, appointment, property, myReview] = await Promise.all([
      User.find({ _id: { $in: userIds } }, { ratingAvg: 1, reviewCount: 1 }).lean(),
      Pro.find({ userId: { $in: proIds } }, { userId: 1, displayName: 1, ratingAvg: 1, reviewCount: 1 }).lean(),
      Appointment.findOne({ ticketId: String(t._id) }).sort({ createdAt: -1 }).select('start end status').lean(),
      t.propertyId && Types.ObjectId.isValid(t.propertyId) ? Property.findById(t.propertyId).select('city').lean() : null,
      reviewer ? Review.findOne({ fromUserId: userId, toUserId: t.proId, relatedId: String(t._id) }).select('score comment createdAt').lean() : null,
    ]);

    const userMap = new Map(users.map(u => [String(u._id), u]));
    const proMap = new Map(pros.map(p => [p.userId, p]));

    const result = {
      ...t,
      pro: t.proId ? {
        id: t.proId,
        displayName: proMap.get(t.proId)?.displayName,
        // Perfil público (/pros/:id), para enlazarlo desde la incidencia
        profileId: proMap.get(t.proId)?._id ? String(proMap.get(t.proId)!._id) : undefined,
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
      // Ciudad del inmueble: el propietario busca profesional ahí primero
      propertyCity: (property as any)?.city || undefined,
      // Última cita propuesta por el profesional (el inquilino la acepta o la rechaza)
      appointment: appointment ? { start: appointment.start, end: appointment.end, status: appointment.status } : null,
      // Valoración del profesional: solo para quien puede dejarla (POST /api/reviews con relatedId = la incidencia)
      proReview: reviewer
        ? { canReview: !myReview, mine: myReview ? { score: myReview.score, comment: myReview.comment, createdAt: myReview.createdAt } : null }
        : undefined,
    };

    res.json(result);
  } catch (err: any) {
    sendRouteError(res, err, 'ticket_request_failed');
  }
});

export default r;
