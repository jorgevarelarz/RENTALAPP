import { Router } from 'express';
import Lead from '../models/lead.model';
import { analyzeInboundLead } from '../services/inboundLead.service';

const r = Router();

r.post('/testing/inbound/webhook', async (req, res) => {
  try {
    const result = await analyzeInboundLead(req.body || {});
    return res.status(200).json({
      leadId: String(result.lead._id),
      externalLeadId: result.lead.externalLeadId,
      leadType: result.leadType,
      leadStatus: result.leadStatus,
      conversationStage: result.conversationStage,
      qualificationScore: result.qualificationScore,
      replyMessage: result.replyMessage,
      nextBestAction: result.nextBestAction,
      suggestedQuestions: result.suggestedQuestions,
      missingFields: result.missingFields,
      scoreReasons: result.scoreReasons,
      messageCount: result.lead.messageCount,
      awaitingUserReply: result.lead.awaitingUserReply,
      changes: result.changes,
      extractedData: result.lead.extractedData,
      timeline: result.lead.timeline,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error?.message || 'testing_inbound_failed' });
  }
});

r.get('/testing/inbound/leads', async (_req, res) => {
  const items = await Lead.find()
    .sort({ updatedAt: -1 })
    .limit(25)
    .select('externalLeadId source leadType leadStatus conversationStage qualificationScore nextBestAction suggestedQuestions messageCount awaitingUserReply lastInboundMessage updatedAt')
    .lean();
  return res.json({ items });
});

r.get('/testing/inbound/leads/:leadId', async (req, res) => {
  const lead = await Lead.findById(req.params.leadId).lean();
  if (!lead) return res.status(404).json({ error: 'lead_not_found' });
  return res.json(lead);
});

export default r;
