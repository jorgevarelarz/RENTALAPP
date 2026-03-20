import Lead, {
  type ConversationStage,
  type ILead,
  type LeadExtractedData,
  type LeadStateChangeSet,
  type LeadStatus,
  type LeadType,
} from '../models/lead.model';

type AnalyzeInput = {
  externalLeadId?: string;
  leadId?: string;
  message: string;
  awaitingUserReply?: boolean;
  source?: string;
};

type AnalyzeResult = {
  lead: ILead;
  leadType: LeadType;
  leadStatus: LeadStatus;
  conversationStage: ConversationStage;
  qualificationScore: number;
  replyMessage: string;
  nextBestAction: string;
  suggestedQuestions: string[];
  missingFields: string[];
  scoreReasons: string[];
  changes: LeadStateChangeSet;
};

const OWNER_HINTS = /\b(vender|vendo|venta|publicar|publico|propietari[oa]|mi piso|mi casa|mi inmueble|alquilar mi|poner en alquiler)\b/i;
const BUYER_HINTS = /\b(busco|buscar|quiero comprar|quiero alquilar|necesito (piso|casa|vivienda)|me interesa comprar|me interesa alquilar)\b/i;
const VISIT_HINTS = /\b(visita|visitar|ver el piso|agenda|cita)\b/i;
const NEGOTIATION_HINTS = /\b(negoci|oferta|contraoferta|rebaja|rebajar)\b/i;
const CLOSED_HINTS = /\b(cerrado|reservado|comprado|alquilado|firmado|ya lo hice)\b/i;
const DISCARDED_HINTS = /\b(descarto|ya no me interesa|no me interesa|cancelar|olvidalo|olvídalo)\b/i;
const REOPEN_HINTS = /\b(reabrir|retomar|volvemos|vuelvo|otra vez|sigue interesado|seguimos|retomo|reactivar)\b/i;
const PHOTO_HINTS = /\b(fotos?|imagenes?|galeria|galería)\b/i;
const DOC_HINTS = /\b(documentacion|documentación|nota simple|escritura|contrato|cedula|cédula|certificado)\b/i;
const FINANCING_HINTS = /\b(hipoteca|financiaci[oó]n|financiar|banco|prestamo|pr[eé]stamo|contado)\b/i;
const RENT_HINTS = /\b(alquiler|alquilar|arrendar|renta)\b/i;
const SALE_HINTS = /\b(venta|vender|comprar|compraventa)\b/i;
const HIGH_URGENCY_HINTS = /\b(urgente|cuanto antes|esta semana|inmediato|ya)\b/i;
const MEDIUM_URGENCY_HINTS = /\b(este mes|pronto|en breve)\b/i;

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

function detectLeadType(message: string, current?: ILead | null): LeadType {
  if (OWNER_HINTS.test(message)) return 'OWNER';
  if (BUYER_HINTS.test(message)) return 'BUYER';
  return current?.leadType || 'UNKNOWN';
}

function parseMoney(message: string) {
  const match = message.match(/(\d[\d.,]{2,})\s*(€|eur|euros?)/i);
  if (!match) return undefined;
  const digits = match[1].replace(/\./g, '').replace(',', '.');
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBedrooms(message: string) {
  const match = message.match(/(\d+)\s*(habitaciones?|hab|dormitorios?)/i);
  if (!match) return undefined;
  return Number(match[1]);
}

function parseSquareMeters(message: string) {
  const match = message.match(/(\d+)\s*(m2|m²|metros)/i);
  if (!match) return undefined;
  return Number(match[1]);
}

function parseZone(message: string) {
  const patterns = [
    /\bzona[:\s-]+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s-]{2,40})(?:[,.]|$)/i,
    /\ben\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s-]{2,40})(?:[,.]|$)/i,
    /\b(?:en|por|zona)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s-]{3,40})(?:[,.]|$)/,
    /\b(?:en la zona de|por la zona de)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s-]{3,40})(?:[,.]|$)/,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return normalizeWhitespace(match[1]);
  }
  return undefined;
}

function parseFinancing(message: string): boolean | undefined {
  if (!FINANCING_HINTS.test(message)) return undefined;
  if (/\b(no|sin)\s+(necesito|quiero|haria|haría)\s+(hipoteca|financiaci[oó]n)\b/i.test(message)) return false;
  if (/\b(contado)\b/i.test(message)) return false;
  return true;
}

function parseUrgency(message: string): LeadExtractedData['urgency'] {
  if (HIGH_URGENCY_HINTS.test(message)) return 'high';
  if (MEDIUM_URGENCY_HINTS.test(message)) return 'medium';
  return undefined;
}

function mergeExtractedData(current: LeadExtractedData | undefined, patch: LeadExtractedData): LeadExtractedData {
  return {
    ...(current || {}),
    ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
  };
}

function extractLeadData(message: string, leadType: LeadType, current?: ILead | null): LeadExtractedData {
  const base = current?.extractedData || {};
  const amount = parseMoney(message);
  const operation =
    RENT_HINTS.test(message) && !SALE_HINTS.test(message)
      ? 'rent'
      : SALE_HINTS.test(message) && !RENT_HINTS.test(message)
        ? 'sale'
        : base.operation;

  const patch: LeadExtractedData = {
    operation,
    zone: parseZone(message),
    squareMeters: parseSquareMeters(message),
    bedrooms: parseBedrooms(message),
    financingNeeded: parseFinancing(message),
    urgency: parseUrgency(message),
    hasPhotos: PHOTO_HINTS.test(message) ? true : base.hasPhotos,
    hasDocumentation: DOC_HINTS.test(message) ? true : base.hasDocumentation,
  };

  if (leadType === 'OWNER') {
    patch.targetPrice = amount;
  } else if (leadType === 'BUYER') {
    patch.budgetMax = amount;
  }

  return mergeExtractedData(base, patch);
}

function getMissingFields(leadType: LeadType, data: LeadExtractedData) {
  if (leadType === 'OWNER') {
    const missing: string[] = [];
    if (!data.operation) missing.push('operation');
    if (!data.zone) missing.push('zone');
    if (!data.targetPrice) missing.push('price');
    if (!data.squareMeters) missing.push('squareMeters');
    if (!data.bedrooms) missing.push('bedrooms');
    if (!data.hasPhotos) missing.push('photos');
    return missing;
  }
  if (leadType === 'BUYER') {
    const missing: string[] = [];
    if (!data.zone) missing.push('zone');
    if (!data.budgetMax) missing.push('budgetMax');
    if (!data.bedrooms) missing.push('bedrooms');
    if (data.financingNeeded === undefined) missing.push('financing');
    if (!data.urgency) missing.push('urgency');
    return missing;
  }
  return ['intent'];
}

function buildOwnerQuestions(data: LeadExtractedData) {
  const questions: string[] = [];
  if (!data.operation) questions.push('¿Es venta o alquiler?');
  if (!data.zone) questions.push('¿En qué zona está el inmueble?');
  if (!data.targetPrice) questions.push('¿Cuál es el precio que tienes en mente?');
  if (!data.hasPhotos) questions.push('¿Tienes fotos disponibles?');
  return questions;
}

function buildBuyerQuestions(data: LeadExtractedData) {
  const questions: string[] = [];
  if (!data.zone) questions.push('¿Qué zonas te interesan más?');
  if (!data.budgetMax) questions.push('¿Cuál es tu presupuesto máximo?');
  if (data.financingNeeded === undefined) questions.push('¿Necesitas financiación?');
  if (!data.bedrooms) questions.push('¿Cuántas habitaciones buscas?');
  return questions;
}

function buildUnknownQuestions() {
  return [
    '¿Estás buscando comprar o vender?',
    '¿Quieres alquilar o publicar un inmueble?',
  ];
}

function calculateQualificationScore(leadType: LeadType, data: LeadExtractedData) {
  if (leadType === 'OWNER') {
    let score = 15;
    if (data.operation) score += 20;
    if (data.zone) score += 20;
    if (data.targetPrice) score += 15;
    if (data.squareMeters) score += 10;
    if (data.bedrooms) score += 10;
    if (data.hasPhotos) score += 5;
    if (data.hasDocumentation) score += 5;
    return Math.min(100, score);
  }
  if (leadType === 'BUYER') {
    let score = 15;
    if (data.zone) score += 25;
    if (data.budgetMax) score += 25;
    if (data.bedrooms) score += 15;
    if (data.financingNeeded !== undefined) score += 10;
    if (data.urgency) score += 10;
    return Math.min(100, score);
  }
  return Math.min(100, (data.operation ? 20 : 0) + (data.zone ? 10 : 0));
}

function buildScoreReasons(leadType: LeadType, data: LeadExtractedData) {
  const reasons: string[] = [];
  if (leadType === 'OWNER') {
    if (data.operation) reasons.push('Incluye operación');
    if (data.zone) reasons.push('Incluye ciudad o zona');
    if (data.targetPrice) reasons.push('Incluye precio objetivo');
    if (data.squareMeters) reasons.push('Incluye metros');
    if (data.bedrooms) reasons.push('Incluye habitaciones');
    if (data.hasPhotos) reasons.push('Incluye fotos');
    if (data.hasDocumentation) reasons.push('Incluye documentación');
  } else if (leadType === 'BUYER') {
    if (data.zone) reasons.push('Incluye ciudad o zona');
    if (data.budgetMax) reasons.push('Incluye presupuesto');
    if (data.bedrooms) reasons.push('Incluye habitaciones');
    if (data.financingNeeded !== undefined) reasons.push('Incluye financiación');
    if (data.urgency) reasons.push('Incluye urgencia');
  } else {
    if (data.operation) reasons.push('Incluye intención de operación');
    if (data.zone) reasons.push('Incluye zona');
  }
  return reasons;
}

function inferConversationStage(input: {
  leadType: LeadType;
  data: LeadExtractedData;
  message: string;
  awaitingUserReply?: boolean;
}): ConversationStage {
  if (input.awaitingUserReply) return 'AWAITING_USER_REPLY';

  if (input.leadType === 'OWNER') {
    const missingOwnerData = [
      !input.data.operation,
      !input.data.zone,
      !input.data.targetPrice,
      !input.data.squareMeters,
      !input.data.bedrooms,
    ].some(Boolean);
    if (missingOwnerData) return 'OWNER_DETAILS_PENDING';
    if (!input.data.hasPhotos || !input.data.hasDocumentation) return 'PROPERTY_MEDIA_PENDING';
    return 'READY_FOR_FOLLOWUP';
  }

  if (input.leadType === 'BUYER') {
    const missingPreferences = [
      !input.data.zone,
      !input.data.budgetMax,
      !input.data.bedrooms,
    ].some(Boolean);
    if (missingPreferences) return 'BUYER_PREFERENCES_PENDING';
    if (input.data.financingNeeded === undefined) return 'FINANCING_PENDING';
    return 'READY_FOR_FOLLOWUP';
  }

  if (RENT_HINTS.test(input.message) || SALE_HINTS.test(input.message) || OWNER_HINTS.test(input.message) || BUYER_HINTS.test(input.message)) {
    return 'INTENT_DETECTED';
  }

  return 'INITIAL_CONTACT';
}

function inferLeadStatus(input: {
  current?: ILead | null;
  message: string;
  qualificationScore: number;
  reopened?: boolean;
}): LeadStatus {
  if (DISCARDED_HINTS.test(input.message)) return 'DISCARDED';
  if (CLOSED_HINTS.test(input.message)) return 'CLOSED';
  if (VISIT_HINTS.test(input.message)) return 'VISIT_PENDING';
  if (NEGOTIATION_HINTS.test(input.message)) return 'NEGOTIATION';
  if (input.qualificationScore >= 80) return 'QUALIFIED';
  if (input.qualificationScore >= 50) return 'PARTIALLY_QUALIFIED';
  if (input.reopened || (input.current?.messageCount || 0) > 0) return 'CONTACTED';
  return 'NEW';
}

function inferNextBestAction(stage: ConversationStage, leadType: LeadType, questions: string[], locked?: boolean) {
  if (locked) {
    return 'El lead está cerrado o descartado. Solo debe avanzar si el nuevo mensaje indica reapertura.';
  }
  switch (stage) {
    case 'OWNER_DETAILS_PENDING':
      return 'Recoger los datos clave del inmueble para calificar al propietario.';
    case 'BUYER_PREFERENCES_PENDING':
      return 'Completar preferencias de búsqueda para perfilar al comprador.';
    case 'FINANCING_PENDING':
      return 'Confirmar si el comprador necesita financiación antes de proponer opciones.';
    case 'PROPERTY_MEDIA_PENDING':
      return 'Solicitar fotos y documentación del inmueble para preparar el siguiente seguimiento.';
    case 'READY_FOR_FOLLOWUP':
      return leadType === 'OWNER'
        ? 'Programar seguimiento comercial con valoración y propuesta de publicación.'
        : 'Programar seguimiento comercial con selección de inmuebles y próximos pasos.';
    case 'AWAITING_USER_REPLY':
      return 'Esperar la respuesta del lead y reactivar el seguimiento cuando conteste.';
    case 'INTENT_DETECTED':
      return 'Confirmar si el lead es propietario o comprador y aclarar la operación.';
    default:
      return questions[0] ? `Hacer la siguiente pregunta: ${questions[0]}` : 'Iniciar conversación y detectar intención.';
  }
}

function buildReplyMessage(input: {
  leadType: LeadType;
  conversationStage: ConversationStage;
  questions: string[];
  nextBestAction: string;
  locked?: boolean;
}) {
  if (input.locked) {
    return 'Este lead está cerrado o descartado. Si quieres reabrirlo, indícalo explícitamente en el siguiente mensaje.';
  }
  if (input.conversationStage === 'READY_FOR_FOLLOWUP') {
    return input.leadType === 'OWNER'
      ? 'Gracias, ya tenemos una base comercial bastante completa. El siguiente paso es revisar contigo la estrategia y los materiales del inmueble.'
      : 'Gracias, ya tenemos una base comercial bastante completa. El siguiente paso es revisar contigo opciones y próximos pasos de seguimiento.';
  }

  if (input.conversationStage === 'AWAITING_USER_REPLY') {
    return 'Te dejamos la conversación preparada. Cuando el lead responda, podremos continuar desde el siguiente paso sugerido.';
  }

  const firstQuestion = input.questions[0];
  return firstQuestion
    ? `Gracias por la información. ${input.nextBestAction} ${firstQuestion}`
    : `Gracias por escribirnos. ${input.nextBestAction}`;
}

function isReopeningMessage(message: string) {
  return REOPEN_HINTS.test(message);
}

function isLockedLead(current?: ILead | null, message?: string) {
  if (!current) return false;
  if (!['CLOSED', 'DISCARDED'].includes(current.leadStatus)) return false;
  return !isReopeningMessage(message || '');
}

function getNewExtractedFields(previous: LeadExtractedData | undefined, next: LeadExtractedData) {
  const prev = previous || {};
  return Object.keys(next).filter((key) => prev[key as keyof LeadExtractedData] === undefined && next[key as keyof LeadExtractedData] !== undefined);
}

function buildChanges(previous: ILead | null, next: {
  leadStatus: LeadStatus;
  conversationStage: ConversationStage;
  qualificationScore: number;
  extractedData: LeadExtractedData;
}): LeadStateChangeSet {
  return {
    leadStatus:
      !previous || previous.leadStatus !== next.leadStatus
        ? { previous: previous?.leadStatus || null, current: next.leadStatus }
        : undefined,
    conversationStage:
      !previous || previous.conversationStage !== next.conversationStage
        ? { previous: previous?.conversationStage || null, current: next.conversationStage }
        : undefined,
    qualificationScore:
      !previous || previous.qualificationScore !== next.qualificationScore
        ? { previous: previous?.qualificationScore ?? null, current: next.qualificationScore }
        : undefined,
    newExtractedFields: getNewExtractedFields(previous?.extractedData, next.extractedData),
  };
}

async function loadLead(input: AnalyzeInput) {
  if (input.leadId) {
    const lead = await Lead.findById(input.leadId);
    if (lead) return lead;
  }
  if (input.externalLeadId) {
    const lead = await Lead.findOne({ externalLeadId: input.externalLeadId });
    if (lead) return lead;
  }
  return null;
}

export async function analyzeInboundLead(input: AnalyzeInput): Promise<AnalyzeResult> {
  const message = normalizeWhitespace(input.message || '');
  if (!message) {
    throw Object.assign(new Error('message_required'), { status: 400 });
  }

  const current = await loadLead(input);
  const locked = isLockedLead(current, message);
  const reopened = !!current && ['CLOSED', 'DISCARDED'].includes(current.leadStatus) && !locked;
  const leadType = detectLeadType(message, current);
  const extractedData = locked ? current!.extractedData : extractLeadData(message, leadType, current);
  const qualificationScore = locked ? current!.qualificationScore : calculateQualificationScore(leadType, extractedData);
  const suggestedQuestions =
    locked
      ? current!.suggestedQuestions
      : leadType === 'OWNER'
        ? buildOwnerQuestions(extractedData)
        : leadType === 'BUYER'
          ? buildBuyerQuestions(extractedData)
          : buildUnknownQuestions();
  const missingFields = locked ? current!.missingFields : getMissingFields(leadType, extractedData);
  const scoreReasons = locked ? current!.scoreReasons : buildScoreReasons(leadType, extractedData);
  const conversationStage = locked
    ? current!.conversationStage
    : inferConversationStage({
        leadType,
        data: extractedData,
        message,
        awaitingUserReply: input.awaitingUserReply,
      });
  const leadStatus = locked
    ? current!.leadStatus
    : inferLeadStatus({
        current,
        message,
        qualificationScore,
        reopened,
      });
  const nextBestAction = inferNextBestAction(conversationStage, leadType, suggestedQuestions, locked);
  const replyMessage = buildReplyMessage({
    leadType,
    conversationStage,
    questions: suggestedQuestions,
    nextBestAction,
    locked,
  });

  const lead =
    current ||
    new Lead({
      externalLeadId: input.externalLeadId || `lead-${Date.now()}`,
      source: input.source || 'testing_inbound',
    });

  const changes = buildChanges(current, {
    leadStatus,
    conversationStage,
    qualificationScore,
    extractedData,
  });

  lead.source = input.source || lead.source || 'testing_inbound';
  lead.leadType = leadType;
  lead.leadStatus = leadStatus;
  lead.conversationStage = conversationStage;
  lead.qualificationScore = qualificationScore;
  lead.nextBestAction = nextBestAction;
  lead.suggestedQuestions = suggestedQuestions;
  lead.missingFields = missingFields;
  lead.scoreReasons = scoreReasons;
  lead.lastInboundMessage = message;
  lead.lastReplyMessage = replyMessage;
  lead.extractedData = extractedData;
  lead.messageCount = (lead.messageCount || 0) + 1;
  lead.awaitingUserReply = conversationStage === 'AWAITING_USER_REPLY';
  lead.lastInboundAt = new Date();
  lead.lastOutboundAt = new Date();
  lead.timeline = [
    ...(lead.timeline || []),
    {
      direction: 'inbound',
      body: message,
      createdAt: new Date(),
      changes,
    },
    {
      direction: 'outbound',
      body: replyMessage,
      createdAt: new Date(),
      changes,
    },
  ];

  await lead.save();

  return {
    lead,
    leadType,
    leadStatus,
    conversationStage,
    qualificationScore,
    replyMessage,
    nextBestAction,
    suggestedQuestions,
    missingFields,
    scoreReasons,
    changes,
  };
}

export function inferConversationStageForLeadDoc(lead: Pick<ILead, 'leadType' | 'extractedData' | 'awaitingUserReply' | 'lastInboundMessage'>) {
  return inferConversationStage({
    leadType: lead.leadType,
    data: lead.extractedData || {},
    message: lead.lastInboundMessage || '',
    awaitingUserReply: lead.awaitingUserReply,
  });
}
