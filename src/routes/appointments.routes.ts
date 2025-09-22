import { Router } from 'express';
import { getUserId } from '../utils/getUserId';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import Appointment from '../models/appointment.model';
import Ticket from '../models/ticket.model';

const r = Router();

async function publishSystem(conversationId: string, senderId: string, systemCode: string, payload?: any) {
  await Message.create({ conversationId, senderId, type: 'system', systemCode, payload, readBy: [] });
  await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: new Date() });
}

async function ensureAppointmentConversation(ticketId: string, proId: string, tenantId: string, ownerId: string) {
  let a = await Appointment.findOne({ ticketId }).sort({ createdAt: -1 }).lean();
  if (!a) return null;
  let conv = await Conversation.findOne({ kind: 'appointment', refId: String(a._id) });
  if (!conv) {
    conv = await Conversation.create({ kind: 'appointment', refId: String(a._id), participants: [proId, tenantId], meta: { appointmentId: String(a._id), proUserId: proId, tenantId, ownerId, ticketId }, unread: {} });
  }
  return conv;
}

// Proponer fecha/hora (pro → tenant)
r.post('/appointments/:ticketId/propose', async (req, res) => {
  try {
    const userId = getUserId(req); // pro
    const { ticketId } = req.params;
    const { start, end, timezone } = req.body || {};
    if (!start || !end || !timezone) {
      return res.status(400).json({ error: 'start_end_timezone_required', code: 400 });
    }
    const s = new Date(start);
    const e = new Date(end);
    if (!(s instanceof Date) || isNaN(s.getTime()) || !(e instanceof Date) || isNaN(e.getTime())) {
      return res.status(400).json({ error: 'invalid_dates', code: 400 });
    }
    if (e <= s) {
      return res.status(400).json({ error: 'end_must_be_after_start', code: 400 });
    }

    const t = await Ticket.findById(ticketId).lean();
    if (!t) return res.status(404).json({ error: 'ticket_not_found' });
    if (t.proId !== userId) return res.status(403).json({ error: 'forbidden' });

    let a = await Appointment.findOne({ ticketId });
    if (!a) {
      a = await Appointment.create({ ticketId, proId: t.proId!, tenantId: t.openedBy, ownerId: t.ownerId, start, end, timezone, status: 'proposed' });
    } else {
      a.start = start; a.end = end; a.timezone = timezone; a.status = 'proposed'; await a.save();
    }
    const conv = await ensureAppointmentConversation(ticketId, t.proId!, t.openedBy, t.ownerId);
    if (conv) await publishSystem(conv.id, userId, 'SLOT_PROPOSED', { start, end, timezone, appointmentId: String(a._id) });
    return res.json(a);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'error' });
  }
});

// Aceptar propuesta (tenant)
r.post('/appointments/:ticketId/accept', async (req, res) => {
  try {
    const userId = getUserId(req); // tenant
    const { ticketId } = req.params;
    const a = await Appointment.findOne({ ticketId }).sort({ createdAt: -1 });
    if (!a) return res.status(404).json({ error: 'appointment_not_found' });
    if (a.tenantId !== userId) return res.status(403).json({ error: 'forbidden' });
    a.status = 'accepted';
    await a.save();
    const conv = await Conversation.findOne({ kind: 'appointment', refId: String(a._id) });
    if (conv) await publishSystem(conv.id, userId, 'APPOINTMENT_ACCEPTED', { appointmentId: String(a._id) });
    await Ticket.findByIdAndUpdate(ticketId, { status: 'scheduled' });
    return res.json(a);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'error' });
  }
});

// Rechazar propuesta (tenant) con motivo
r.post('/appointments/:ticketId/reject', async (req, res) => {
  try {
    const userId = getUserId(req); // tenant
    const { ticketId } = req.params;
    const { reason } = req.body || {};
    const a = await Appointment.findOne({ ticketId }).sort({ createdAt: -1 });
    if (!a) return res.status(404).json({ error: 'appointment_not_found' });
    if (a.tenantId !== userId) return res.status(403).json({ error: 'forbidden' });
    a.status = 'rescheduled';
    await a.save();
    const conv = await Conversation.findOne({ kind: 'appointment', refId: String(a._id) });
    if (conv) await publishSystem(conv.id, userId, 'APPOINTMENT_REJECTED', { appointmentId: String(a._id), reason });
    return res.json(a);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message || 'error' });
  }
});

export default r;
