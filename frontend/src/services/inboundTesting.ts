import { api } from '../api/client';

export type LeadType = 'OWNER' | 'BUYER' | 'UNKNOWN';
export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'PARTIALLY_QUALIFIED'
  | 'QUALIFIED'
  | 'VISIT_PENDING'
  | 'NEGOTIATION'
  | 'CLOSED'
  | 'DISCARDED';
export type ConversationStage =
  | 'INITIAL_CONTACT'
  | 'INTENT_DETECTED'
  | 'OWNER_DETAILS_PENDING'
  | 'BUYER_PREFERENCES_PENDING'
  | 'FINANCING_PENDING'
  | 'PROPERTY_MEDIA_PENDING'
  | 'READY_FOR_FOLLOWUP'
  | 'AWAITING_USER_REPLY';

export interface LeadChanges {
  leadStatus?: { previous: string | null; current: string | null };
  conversationStage?: { previous: string | null; current: string | null };
  qualificationScore?: { previous: number | null; current: number | null };
  newExtractedFields?: string[];
}

export interface LeadTimelineEntry {
  direction: 'inbound' | 'outbound';
  body: string;
  createdAt: string;
  changes?: LeadChanges;
}

export interface InboundLeadResponse {
  leadId: string;
  externalLeadId: string;
  leadType: LeadType;
  leadStatus: LeadStatus;
  conversationStage: ConversationStage;
  qualificationScore: number;
  replyMessage: string;
  nextBestAction: string;
  suggestedQuestions: string[];
  missingFields: string[];
  scoreReasons: string[];
  messageCount: number;
  awaitingUserReply: boolean;
  changes: LeadChanges;
  extractedData: Record<string, unknown>;
  timeline: LeadTimelineEntry[];
}

export interface LeadSummary {
  _id: string;
  externalLeadId: string;
  source: string;
  leadType: LeadType;
  leadStatus: LeadStatus;
  conversationStage: ConversationStage;
  qualificationScore: number;
  nextBestAction?: string;
  suggestedQuestions: string[];
  messageCount: number;
  awaitingUserReply: boolean;
  lastInboundMessage?: string;
  updatedAt?: string;
}

export interface LeadDetail extends LeadSummary {
  missingFields: string[];
  scoreReasons: string[];
  extractedData: Record<string, unknown>;
  timeline: LeadTimelineEntry[];
}

export async function simulateInboundWebhook(payload: {
  externalLeadId?: string;
  leadId?: string;
  message: string;
  awaitingUserReply?: boolean;
}) {
  const { data } = await api.post<InboundLeadResponse>('/api/testing/inbound/webhook', payload);
  return data;
}

export async function listInboundLeads() {
  const { data } = await api.get<{ items: LeadSummary[] }>('/api/testing/inbound/leads');
  return data.items;
}

export async function getInboundLead(leadId: string) {
  const { data } = await api.get<LeadDetail>(`/api/testing/inbound/leads/${leadId}`);
  return data;
}
