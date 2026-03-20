import { Schema, model, Document } from 'mongoose';

export const LEAD_TYPES = ['OWNER', 'BUYER', 'UNKNOWN'] as const;
export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'PARTIALLY_QUALIFIED',
  'QUALIFIED',
  'VISIT_PENDING',
  'NEGOTIATION',
  'CLOSED',
  'DISCARDED',
] as const;
export const CONVERSATION_STAGES = [
  'INITIAL_CONTACT',
  'INTENT_DETECTED',
  'OWNER_DETAILS_PENDING',
  'BUYER_PREFERENCES_PENDING',
  'FINANCING_PENDING',
  'PROPERTY_MEDIA_PENDING',
  'READY_FOR_FOLLOWUP',
  'AWAITING_USER_REPLY',
] as const;

export type LeadType = typeof LEAD_TYPES[number];
export type LeadStatus = typeof LEAD_STATUSES[number];
export type ConversationStage = typeof CONVERSATION_STAGES[number];

export interface LeadExtractedData {
  operation?: 'sale' | 'rent';
  zone?: string;
  targetPrice?: number;
  budgetMax?: number;
  squareMeters?: number;
  bedrooms?: number;
  financingNeeded?: boolean;
  urgency?: 'low' | 'medium' | 'high';
  hasPhotos?: boolean;
  hasDocumentation?: boolean;
}

export interface LeadChange<T = string | number | null> {
  previous: T;
  current: T;
}

export interface LeadStateChangeSet {
  leadStatus?: LeadChange<string | null>;
  conversationStage?: LeadChange<string | null>;
  qualificationScore?: LeadChange<number | null>;
  newExtractedFields?: string[];
}

export interface LeadTimelineEntry {
  direction: 'inbound' | 'outbound';
  body: string;
  createdAt: Date;
  changes?: LeadStateChangeSet;
}

export interface ILead extends Document {
  externalLeadId: string;
  source: string;
  leadType: LeadType;
  leadStatus: LeadStatus;
  conversationStage: ConversationStage;
  qualificationScore: number;
  nextBestAction?: string;
  suggestedQuestions: string[];
  missingFields: string[];
  scoreReasons: string[];
  lastInboundMessage?: string;
  lastReplyMessage?: string;
  extractedData: LeadExtractedData;
  timeline: LeadTimelineEntry[];
  messageCount: number;
  awaitingUserReply: boolean;
  lastInboundAt?: Date;
  lastOutboundAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const leadChangeSchema = new Schema(
  {
    previous: Schema.Types.Mixed,
    current: Schema.Types.Mixed,
  },
  { _id: false },
);

const leadStateChangeSetSchema = new Schema(
  {
    leadStatus: { type: leadChangeSchema, required: false },
    conversationStage: { type: leadChangeSchema, required: false },
    qualificationScore: { type: leadChangeSchema, required: false },
    newExtractedFields: { type: [String], default: undefined },
  },
  { _id: false },
);

const leadTimelineEntrySchema = new Schema(
  {
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    body: { type: String, required: true },
    createdAt: { type: Date, required: true },
    changes: { type: leadStateChangeSetSchema, required: false },
  },
  { _id: false },
);

const LeadSchema = new Schema<ILead>({
  externalLeadId: { type: String, required: true, unique: true, index: true },
  source: { type: String, default: 'testing_inbound' },
  leadType: { type: String, enum: LEAD_TYPES, default: 'UNKNOWN' },
  leadStatus: { type: String, enum: LEAD_STATUSES, default: 'NEW' },
  conversationStage: { type: String, enum: CONVERSATION_STAGES, default: 'INITIAL_CONTACT' },
  qualificationScore: { type: Number, default: 0 },
  nextBestAction: String,
  suggestedQuestions: { type: [String], default: [] },
  missingFields: { type: [String], default: [] },
  scoreReasons: { type: [String], default: [] },
  lastInboundMessage: String,
  lastReplyMessage: String,
  extractedData: { type: Schema.Types.Mixed, default: {} },
  timeline: { type: [leadTimelineEntrySchema], default: [] },
  messageCount: { type: Number, default: 0 },
  awaitingUserReply: { type: Boolean, default: false },
  lastInboundAt: Date,
  lastOutboundAt: Date,
}, { timestamps: true });

LeadSchema.index({ leadType: 1, leadStatus: 1 });
LeadSchema.index({ conversationStage: 1, updatedAt: -1 });

export default model<ILead>('Lead', LeadSchema);
