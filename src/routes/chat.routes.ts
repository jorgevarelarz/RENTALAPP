import { Router } from 'express';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import { Contract } from '../models/contract.model';
import Ticket from '../models/ticket.model';
import Appointment from '../models/appointment.model';
import { Application } from '../models/application.model';
import { Property } from '../models/property.model';
import ServiceOffer from '../models/serviceOffer.model';
import { getUserId } from '../utils/getUserId';
import { User } from '../models/user.model';
import { isValidObjectId } from 'mongoose';
import { ensureDirectConversation } from '../utils/ensureDirectConversation';

const r = Router();

function parsePagination(query: any) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 20));
  return { page, limit };
}

async function ensureConversation(kind: string, refId: string, userId: string) {
  if (kind === 'direct') {
    if (!isValidObjectId(refId)) {
      throw Object.assign(new Error('Invalid user id'), { status: 400 });
    }
    const allowed = await canChatDirect(userId, refId);
    if (!allowed) throw Object.assign(new Error('Forbidden'), { status: 403 });
    const direct = await ensureDirectConversation(userId, refId);
    return direct;
  }

  let conv = await Conversation.findOne({ kind, refId });
  let participants: string[] = [];
  let meta: any = {};
  if (kind === 'contract') {
    const c = await Contract.findById(refId).lean();
    if (!c) throw Object.assign(new Error('Contract not found'), { status: 404 });
    if (![String(c.landlord), String(c.tenant)].includes(userId)) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    participants = [String(c.landlord), String(c.tenant)];
    meta.contractId = refId;
    meta.ownerId = String(c.landlord);
    meta.tenantId = String(c.tenant);
  } else if (kind === 'ticket') {
    const t = await Ticket.findById(refId).lean();
    if (!t) throw Object.assign(new Error('Ticket not found'), { status: 404 });
    if (![t.ownerId, t.proId, t.openedBy].includes(userId)) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    participants = [t.ownerId, t.openedBy, t.proId].filter(Boolean) as string[];
    participants = Array.from(new Set(participants));
    meta.ticketId = refId;
    meta.ownerId = t.ownerId;
    meta.proUserId = t.proId;
    meta.contractId = t.contractId;
    meta.tenantId = t.openedBy;
    if (t.propertyId) meta.propertyId = t.propertyId;

    if (conv) {
      const merged = Array.from(new Set([...(conv.participants || []), ...participants]));
      const metaMerged = { ...(conv.meta || {}), ...meta };
      const changed = merged.length !== (conv.participants || []).length || JSON.stringify(metaMerged) !== JSON.stringify(conv.meta || {});
      if (changed) {
        conv.participants = merged;
        conv.meta = metaMerged;
        await conv.save();
      }
      return conv;
    }
  } else if (kind === 'appointment') {
    const a = await Appointment.findById(refId).lean();
    if (!a) throw Object.assign(new Error('Appointment not found'), { status: 404 });
    if (![a.proId, a.tenantId].includes(userId)) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    participants = [a.proId, a.tenantId];
    meta.appointmentId = refId;
    meta.proUserId = a.proId;
    meta.tenantId = a.tenantId;
    meta.ownerId = a.ownerId;
    meta.ticketId = a.ticketId;
  } else {
    throw Object.assign(new Error('Invalid kind'), { status: 400 });
  }

  if (conv) return conv;
  conv = await Conversation.create({ kind, refId, participants, meta, unread: {} });
  return conv;
}

async function canChatDirect(userId: string, otherId: string) {
  const pairContract = await Contract.findOne({
    $or: [
      { tenant: userId, landlord: otherId },
      { tenant: otherId, landlord: userId },
    ],
  }).lean();
  if (pairContract) return true;

  const pairTicket = await Ticket.findOne({
    $or: [
      { openedBy: userId, ownerId: otherId },
      { openedBy: otherId, ownerId: userId },
      { proId: userId, ownerId: otherId },
      { proId: otherId, ownerId: userId },
      { proId: userId, openedBy: otherId },
      { proId: otherId, openedBy: userId },
    ],
  }).lean();
  if (pairTicket) return true;

  const pairAppointment = await Appointment.findOne({
    $or: [
      { tenantId: userId, ownerId: otherId },
      { tenantId: otherId, ownerId: userId },
      { tenantId: userId, proId: otherId },
      { tenantId: otherId, proId: userId },
    ],
  }).lean();
  if (pairAppointment) return true;

  const pairOffer = await ServiceOffer.findOne({
    $or: [
      { ownerId: userId, proId: otherId },
      { ownerId: otherId, proId: userId },
    ],
  }).lean();
  if (pairOffer) return true;

  const appTenantSide = await Application.findOne({ tenantId: userId })
    .populate({ path: 'propertyId', match: { owner: otherId }, select: 'owner' })
    .lean();
  if (appTenantSide?.propertyId) return true;

  const appOwnerSide = await Application.findOne({ tenantId: otherId })
    .populate({ path: 'propertyId', match: { owner: userId }, select: 'owner' })
    .lean();
  if (appOwnerSide?.propertyId) return true;

  return false;
}

// Rate limiting messages per conversation: 20 por minuto
const messageTimestamps = new Map<string, number[]>();
// Rate limiting mensajes por usuario (global): 60 por minuto
const userTimestamps = new Map<string, number[]>();

r.get('/conversations', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { page, limit } = parsePagination(req.query);
    const { kind } = req.query as { kind?: string };
    const baseQuery: any = { participants: userId };
    if (kind) baseQuery.kind = kind;
    const list = await Conversation.find(baseQuery)
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const convIds = list.map(c => String(c._id));
    const lastMessages = convIds.length === 0 ? [] : await Message.aggregate([
      { $match: { conversationId: { $in: convIds } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$conversationId', doc: { $first: '$$ROOT' } } },
    ]);
    const lastMessageMap = new Map(lastMessages.map((m: any) => [String(m._id), m.doc]));
    // Enriquecer con mini perfil público de participantes (isPro/proLimit)
    const ids = Array.from(new Set(list.flatMap(c => c.participants.map(p => String(p)))));
    const validIds = ids.filter(id => isValidObjectId(id));
    const users = await User.find({ _id: { $in: validIds } })
      .select('name role avatar tenantPro.status tenantPro.maxRent')
      .lean();
    const umap = new Map(users.map((u: any) => [String(u._id), u]));
      const result = list.map(c => ({
      ...c,
      unreadForMe: c.unread?.[userId] || 0,
      lastMessage: lastMessageMap.get(String(c._id))
        ? {
            type: lastMessageMap.get(String(c._id)).type,
            body: lastMessageMap.get(String(c._id)).body,
            systemCode: lastMessageMap.get(String(c._id)).systemCode,
            senderId: lastMessageMap.get(String(c._id)).senderId,
            createdAt: lastMessageMap.get(String(c._id)).createdAt,
            attachmentUrl: lastMessageMap.get(String(c._id)).attachmentUrl,
          }
        : undefined,
      participantsInfo: c.participants.map((pid: any) => {
        const u: any = umap.get(String(pid));
        const isPro = u?.tenantPro?.status === 'verified';
        const proLimit = typeof u?.tenantPro?.maxRent === 'number' && u.tenantPro.maxRent > 0 ? u.tenantPro.maxRent : undefined;
        return { id: String(pid), name: u?.name, role: u?.role, avatar: u?.avatar, isPro, proLimit };
      }),
    }));
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

r.post('/conversations/ensure', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { kind, refId } = req.body || {};
    const conv = await ensureConversation(kind, refId, userId);
    const ids = conv.participants.map(p => String(p));
    const validIds = ids.filter(id => isValidObjectId(id));
    const users = await User.find({ _id: { $in: validIds } })
      .select('name role avatar tenantPro.status tenantPro.maxRent')
      .lean();
    const umap = new Map(users.map((u: any) => [String(u._id), u]));
    const participantsInfo = conv.participants.map((pid: any) => {
      const u: any = umap.get(String(pid));
      const isPro = u?.tenantPro?.status === 'verified';
      const proLimit = typeof u?.tenantPro?.maxRent === 'number' && u.tenantPro.maxRent > 0 ? u.tenantPro.maxRent : undefined;
      return { id: String(pid), name: u?.name, role: u?.role, avatar: u?.avatar, isPro, proLimit };
    });
    res.json({ ...(conv.toObject ? conv.toObject() : conv), participantsInfo });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

r.get('/related-users', async (req, res) => {
  try {
    const userId = getUserId(req);
    const ids = new Set<string>();

    const contracts = await Contract.find({ $or: [{ tenant: userId }, { landlord: userId }] })
      .select('tenant landlord')
      .lean();
    contracts.forEach(c => {
      ids.add(String(c.tenant));
      ids.add(String(c.landlord));
    });

    const tickets = await Ticket.find({ $or: [{ openedBy: userId }, { ownerId: userId }, { proId: userId }] })
      .select('openedBy ownerId proId')
      .lean();
    tickets.forEach(t => {
      ids.add(String(t.openedBy));
      ids.add(String(t.ownerId));
      if (t.proId) ids.add(String(t.proId));
    });

    const appointments = await Appointment.find({ $or: [{ tenantId: userId }, { ownerId: userId }, { proId: userId }] })
      .select('tenantId ownerId proId')
      .lean();
    appointments.forEach(a => {
      ids.add(String(a.tenantId));
      ids.add(String(a.ownerId));
      if (a.proId) ids.add(String(a.proId));
    });

    const offers = await ServiceOffer.find({ $or: [{ ownerId: userId }, { proId: userId }] })
      .select('ownerId proId')
      .lean();
    offers.forEach(o => {
      ids.add(String(o.ownerId));
      ids.add(String(o.proId));
    });

    const appsAsTenant = await Application.find({ tenantId: userId }).select('propertyId').lean();
    const propIds = appsAsTenant.map(a => a.propertyId).filter(Boolean);
    if (propIds.length > 0) {
      const props = await Property.find({ _id: { $in: propIds } }).select('owner').lean();
      props.forEach(p => ids.add(String(p.owner)));
    }

    const ownerProps = await Property.find({ owner: userId }).select('_id').lean();
    if (ownerProps.length > 0) {
      const appsAsOwner = await Application.find({ propertyId: { $in: ownerProps.map(p => p._id) } })
        .select('tenantId')
        .lean();
      appsAsOwner.forEach(a => ids.add(String(a.tenantId)));
    }

    ids.delete(String(userId));
    const validIds = Array.from(ids).filter(id => isValidObjectId(id));
    const users = await User.find({ _id: { $in: validIds } })
      .select('name role avatar tenantPro.status tenantPro.maxRent')
      .lean();
    const result = users.map((u: any) => {
      const isPro = u?.tenantPro?.status === 'verified';
      const proLimit = typeof u?.tenantPro?.maxRent === 'number' && u.tenantPro.maxRent > 0 ? u.tenantPro.maxRent : undefined;
      return { id: String(u._id), name: u?.name, role: u?.role, avatar: u?.avatar, isPro, proLimit };
    });
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

r.post('/:conversationId/messages', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { conversationId } = req.params;
    const conv = await Conversation.findById(conversationId);
    if (!conv) throw Object.assign(new Error('Conversation not found'), { status: 404 });
    if (!conv.participants.includes(userId)) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    // rate limit
    const now = Date.now();
    const convStamps = messageTimestamps.get(conversationId) || [];
    const convRecent = convStamps.filter(ts => now - ts < 60 * 1000);
    if (convRecent.length >= 20) {
      throw Object.assign(new Error('Rate limit'), { status: 429 });
    }
    convRecent.push(now);
    messageTimestamps.set(conversationId, convRecent);

    const userStamps = userTimestamps.get(userId) || [];
    const userRecent = userStamps.filter(ts => now - ts < 60 * 1000);
    if (userRecent.length >= 60) {
      throw Object.assign(new Error('Rate limit (user)'), { status: 429 });
    }
    userRecent.push(now);
    userTimestamps.set(userId, userRecent);

    const { body, attachmentUrl } = req.body || {};
    // Sanitizar: cuerpo máximo 2k, attachmentUrl solo dominios permitidos
    const text = typeof body === 'string' ? String(body).slice(0, 2000) : undefined;
    let url: string | undefined = typeof attachmentUrl === 'string' ? String(attachmentUrl) : undefined;
    if (url) {
      const allow = (process.env.UPLOADS_BASE_URL || '').split(',').map(s=>s.trim()).filter(Boolean);
      const ok = allow.length === 0
        ? /^https?:\/\//i.test(url) || url.startsWith('/uploads/')
        : allow.some(prefix => url.startsWith(prefix));
      if (!ok) {
        return res.status(400).json({ error: 'attachment_domain_not_allowed' });
      }
    }
    const msg = await Message.create({ conversationId, senderId: userId, type: 'user', body: text, attachmentUrl: url, readBy: [userId] });
    conv.lastMessageAt = new Date();
    conv.participants.forEach(p => {
      conv.unread = conv.unread || {};
      if (p !== userId) {
        conv.unread[p] = (conv.unread[p] || 0) + 1;
      }
    });
    await conv.save();
    res.status(201).json(msg);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

r.get('/:conversationId/messages', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { conversationId } = req.params;
    const { before, limit = 20 } = req.query as any;
    const conv = await Conversation.findById(conversationId);
    if (!conv) throw Object.assign(new Error('Conversation not found'), { status: 404 });
    if (!conv.participants.includes(userId)) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    const q: any = { conversationId };
    if (before) q.createdAt = { $lt: new Date(before) };
    const msgs = await Message.find(q).sort({ createdAt: -1 }).limit(Number(limit)).lean();
    res.json(msgs);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

r.post('/:conversationId/read', async (req, res) => {
  try {
    const userId = getUserId(req);
    const { conversationId } = req.params;
    const conv = await Conversation.findById(conversationId);
    if (!conv) throw Object.assign(new Error('Conversation not found'), { status: 404 });
    if (!conv.participants.includes(userId)) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    conv.unread[userId] = 0;
    await conv.save();
    await Message.updateMany({ conversationId, readBy: { $ne: userId } }, { $addToSet: { readBy: userId } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default r;
