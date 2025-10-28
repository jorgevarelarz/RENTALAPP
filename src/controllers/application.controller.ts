import { Request, Response } from 'express';
import { Application } from '../models/application.model';
import { Property } from '../models/property.model';
import { User } from '../models/user.model';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import { sendEmail } from '../utils/notification';
import getRequestLogger from '../utils/requestLogger';
import { AppError } from '../utils/errors';

export async function listMine(req: Request, res: Response) {
  const userId = (req as any).user?._id || (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const log = getRequestLogger(req);

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { page = '1', limit = '20' } = req.query as any;
  const pg = Math.max(1, parseInt(String(page), 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 10));

  const filter = { tenantId: String(userId) };

  const [items, total] = await Promise.all([
    Application.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Application.countDocuments(filter),
  ]);

  const propertyIds = [...new Set(items.map(item => item.propertyId))];
  const props = await Property.find({ _id: { $in: propertyIds } }).select('title city price owner onlyTenantPro').lean();
  const propMap = new Map(props.map(p => [String(p._id), p]));

  const enriched = items.map(item => ({
    id: String(item._id),
    propertyId: item.propertyId,
    status: item.status,
    createdAt: item.createdAt,
    visitDate: item.visitDate,
    property: propMap.get(item.propertyId) || null,
  }));

  log.info(
    {
      tenantId: String(userId),
      items: enriched.length,
      total,
    },
    '[applications] listMine response',
  );

  res.json({ items: enriched, page: pg, limit: lim, total });
}

export async function listForOwner(req: Request, res: Response) {
  const userId = (req as any).user?._id || (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const log = getRequestLogger(req);

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { status, page = '1', limit = '20' } = req.query as any;
  const pg = Math.max(1, parseInt(String(page), 10) || 1);
  const lim = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 10));

  const owned = await Property.find({ owner: userId }).select('_id').lean();
  if (owned.length === 0) {
    return res.json({ items: [], total: 0, page: pg, limit: lim });
  }

  const propertyIds = owned.map(doc => String(doc._id));
  const filter: any = { propertyId: { $in: propertyIds } };
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Application.find(filter).sort({ createdAt: -1 }).skip((pg - 1) * lim).limit(lim).lean(),
    Application.countDocuments(filter),
  ]);

  const fullPropertyIds = [...new Set(items.map(item => item.propertyId))];
  const tenantIds = [...new Set(items.map(item => item.tenantId))];

  const [props, tenants] = await Promise.all([
    Property.find({ _id: { $in: fullPropertyIds } }).select('title city price onlyTenantPro').lean(),
    User.find({ _id: { $in: tenantIds } }).select('email name tenantPro').lean(),
  ]);

  const propMap = new Map(props.map(p => [String(p._id), p]));
  const tenantMap = new Map(tenants.map(t => [String(t._id), t]));

  const enriched = items.map(item => {
    const tenant = tenantMap.get(item.tenantId);
    const tenantPro = tenant ? ((tenant as any)?.tenantPro || {}) : {};
    return {
      id: String(item._id),
      propertyId: item.propertyId,
      status: item.status,
      createdAt: item.createdAt,
      visitDate: item.visitDate,
      property: propMap.get(item.propertyId) || null,
      tenant: tenant
        ? {
            id: String(tenant._id),
            email: tenant.email,
            name: tenant.name,
            tenantProStatus: tenantPro?.status,
            tenantProMaxRent: tenantPro?.maxRent,
          }
        : null,
    };
  });

  log.info(
    {
      ownerId: String(userId),
      items: enriched.length,
      total,
    },
    '[applications] listForOwner response',
  );

  res.json({ items: enriched, page: pg, limit: lim, total });
}

async function ensureOwnerApplication(applicationId: string, ownerId: string) {
  const application = await Application.findById(applicationId);
  if (!application) throw Object.assign(new Error('application_not_found'), { status: 404 });
  const property = await Property.findById(application.propertyId);
  if (!property) throw Object.assign(new Error('property_not_found'), { status: 404 });
  if (String(property.owner) !== ownerId) {
    throw Object.assign(new Error('forbidden'), { status: 403 });
  }
  return { application, property };
}

function appendHistory(app: any, actorId: string, action: string, payload?: Record<string, unknown>) {
  if (!Array.isArray(app.history)) app.history = [];
  app.history.push({ ts: new Date(), actorId, action, payload });
}

export async function decide(req: Request, res: Response) {
  try {
    const actorId = (req as any).user?._id || (req as any).user?.id;
    if (!actorId) return res.status(401).json({ error: 'unauthorized' });
    const { decision, reason } = req.body as { decision?: 'accept' | 'reject' | 'approved' | 'rejected'; reason?: string };
    if (!decision || !['accept', 'reject', 'approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'invalid_decision' });
    }
    const normalized = decision === 'accept' || decision === 'approved' ? 'accepted' : 'rejected';
    const { application, property } = await ensureOwnerApplication(req.params.id, String(actorId));
    if (application.status === normalized) {
      return res.status(409).json({ error: 'already_' + normalized });
    }
    if (application.status !== 'pending') {
      return res.status(409).json({ error: 'already_resolved' });
    }

    application.status = normalized as any;
    appendHistory(application, String(actorId), normalized === 'accepted' ? 'approved' : 'rejected', reason ? { reason } : undefined);
    await application.save();

    const tenant = await User.findById(application.tenantId).select('email name');
    if (tenant?.email) {
      const subject = normalized === 'accepted' ? 'Tu solicitud ha sido aprobada' : 'Tu solicitud ha sido rechazada';
      const body = normalized === 'accepted'
        ? `Buenas,

Tu solicitud para la propiedad "${property.title}" ha sido aprobada. Ponte en contacto con el propietario para avanzar con el contrato.

Saludos,
RentalApp`
        : `Buenas,

Tu solicitud para la propiedad "${property.title}" ha sido rechazada.${reason ? `

Motivo: ${reason}` : ''}

Saludos,
RentalApp`;
      sendEmail(tenant.email, subject, body).catch(err => getRequestLogger(req).error({ err }, 'error_send_application_notification'));
    }

    res.json({ ok: true, status: application.status });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'decision_failed' });
  }
}

export async function toggleTenantPro(req: Request, res: Response) {
  try {
    const actorId = (req as any).user?._id || (req as any).user?.id;
    if (!actorId) return res.status(401).json({ error: 'unauthorized' });
    const { enable } = req.body as { enable?: boolean };
    if (typeof enable !== 'boolean') return res.status(400).json({ error: 'invalid_enable_flag' });
    const { application } = await ensureOwnerApplication(req.params.id, String(actorId));
    const tenant = await User.findById(application.tenantId);
    if (!tenant) throw Object.assign(new Error('tenant_not_found'), { status: 404 });
    const tenantDoc: any = tenant;
    tenantDoc.tenantPro = tenantDoc.tenantPro || {};
    if (enable) {
      tenantDoc.tenantPro.status = 'verified';
      tenantDoc.tenantPro.isActive = true;
      tenantDoc.tenantPro.lastDecisionAt = new Date();
      tenantDoc.tenantPro.maxRent = tenantDoc.tenantPro.maxRent ?? 0;
    } else {
      tenantDoc.tenantPro.status = 'none';
      tenantDoc.tenantPro.isActive = false;
    }
    await tenantDoc.save();
    appendHistory(application, String(actorId), enable ? 'tenant_pro_granted' : 'tenant_pro_revoked');
    await application.save();
    res.json({ ok: true, tenantPro: { status: tenantDoc.tenantPro?.status, maxRent: tenantDoc.tenantPro?.maxRent } });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'toggle_failed' });
  }
}

async function ensureApplicationConversation(application: any, property: any) {
  const refId = String(application._id);
  let conv = await Conversation.findOne({ kind: 'application', refId });
  if (!conv) {
    conv = await Conversation.create({
      kind: 'application',
      refId,
      participants: [String(property.owner), String(application.tenantId)],
      meta: {
        applicationId: refId,
        ownerId: String(property.owner),
        tenantId: String(application.tenantId),
        propertyId: application.propertyId,
      },
      unread: {},
    });
  }
  return conv;
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const actorId = (req as any).user?._id || (req as any).user?.id;
    if (!actorId) return res.status(401).json({ error: 'unauthorized' });
    const { message } = req.body as { message?: string };
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) return res.status(400).json({ error: 'message_required' });
    const { application, property } = await ensureOwnerApplication(req.params.id, String(actorId));
    const conv = await ensureApplicationConversation(application, property);
    if (!conv.participants.includes(String(actorId))) {
      throw new AppError('forbidden', { status: 403 });
    }
    const msg = await Message.create({
      conversationId: String(conv._id),
      senderId: String(actorId),
      type: 'user',
      body: text.slice(0, 2000),
      readBy: [String(actorId)],
    });
    conv.lastMessageAt = new Date();
    conv.unread = conv.unread || {};
    conv.participants.forEach(p => {
      if (String(p) !== String(actorId)) {
        conv.unread[String(p)] = (conv.unread[String(p)] || 0) + 1;
      }
    });
    await conv.save();
    appendHistory(application, String(actorId), 'message_sent', { message: text.slice(0, 120) });
    await application.save();
    res.status(201).json({ ok: true, message: msg });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'message_failed' });
  }
}
