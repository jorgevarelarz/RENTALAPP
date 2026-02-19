import { GoogleGenerativeAI } from '@google/generative-ai';
import { Types } from 'mongoose';
import { Contract } from '../models/contract.model';
import { Payment } from '../models/payment.model';
import { RentPayment } from '../models/rentPayment.model';
import Ticket from '../models/ticket.model';
import Appointment from '../models/appointment.model';
import { User } from '../models/user.model';
import { Property } from '../models/property.model';
import { getLatestLauDocument, upsertLatestLauDocument } from './legalDocuments.service';

const MODEL_NAME = 'gemini-flash-latest';

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'de', 'del', 'y', 'o', 'a', 'en', 'por', 'para', 'un', 'una', 'que',
  'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'es', 'son', 'al', 'con', 'se', 'si', 'qué', 'cuando',
  'donde', 'como', 'cuál', 'cuáles', 'puedo', 'debo', 'quiero', 'sobre',
]);

const pickKeywords = (query: string) => {
  const words = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return Array.from(new Set(words)).slice(0, 8);
};

const extractLauSections = (content: string, query: string) => {
  if (!content) return [];
  const keywords = pickKeywords(query);
  const sections = content.split(/\n(?=Artículo\s+\d+|Disposición|Capítulo|Título)/i);
  if (keywords.length === 0) return sections.slice(0, 3);
  const scored = sections.map((section) => {
    const lower = section.toLowerCase();
    const score = keywords.reduce((acc, k) => acc + (lower.includes(k) ? 1 : 0), 0);
    return { section, score };
  }).filter(s => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map(s => s.section.trim());
};

const buildPrompt = (input: {
  query: string;
  platformContext: Record<string, unknown>;
  lauContext?: { versionDate?: string; url?: string; excerpts?: string[] };
}) => {
  const { query, platformContext, lauContext } = input;
  const lauText = lauContext?.excerpts?.length
    ? lauContext.excerpts.join('\n\n')
    : 'No disponible.';
  const lauVersion = lauContext?.versionDate || 'desconocida';
  const lauUrl = lauContext?.url || 'No disponible';

  return [
    'Eres Clara, la asistente de la plataforma de alquiler.',
    'Tono: cercano y profesional.',
    'Reglas estrictas:',
    '- Usa SOLO los datos incluidos en CONTEXTO_PLATAFORMA y CONTEXTO_LAU.',
    '- Si falta información para responder, dilo con naturalidad.',
    '- No inventes fechas, importes, personas ni estados.',
    '- Si la pregunta solicita datos de otros usuarios o de cuentas ajenas, indica que no puedes acceder a esa información.',
    '- Si la pregunta es legal, usa solo CONTEXTO_LAU e incluye en la misma respuesta:',
    `  - La versión consultada de la LAU (${lauVersion}).`,
    '  - Un aviso breve: "Puede contener errores; para casos específicos, consulta a un abogado."',
    '- Si la pregunta no es legal, no menciones LAU.',
    'Formato de salida:',
    '- Responde en texto natural, como una conversación.',
    '- No uses secciones, listas técnicas ni encabezados.',
    '',
    'CONTEXTO_PLATAFORMA (JSON):',
    JSON.stringify(platformContext, null, 2),
    '',
    'CONTEXTO_LAU (extractos):',
    `URL: ${lauUrl}`,
    `Versión: ${lauVersion}`,
    lauText,
    '',
    'PREGUNTA DEL USUARIO:',
    query,
  ].join('\n');
};

export async function buildPlatformContext(userId: string) {
  const contracts = await Contract.find({
    $or: [{ landlord: userId }, { tenant: userId }],
  })
    .select('startDate endDate status rent deposit region clauses landlord tenant property createdAt')
    .populate('property', 'address title city')
    .lean();

  const contractIds = contracts
    .map(c => String(c._id))
    .filter(id => Types.ObjectId.isValid(id))
    .map(id => new Types.ObjectId(id));
  const rentPayments = contractIds.length
    ? await RentPayment.find({ contractId: { $in: contractIds } })
      .select('contractId period amount status paidAt createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
    : [];

  const payments = await Payment.find({
    $or: [{ payer: userId }, { payee: userId }],
  })
    .select('contract amount currency status type concept dueDate paidAt createdAt')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const tickets = await Ticket.find({
    $or: [{ openedBy: userId }, { ownerId: userId }, { proId: userId }],
  })
    .select('title description status service quote extra proId ownerId openedBy contractId createdAt')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const appointments = await Appointment.find({
    $or: [{ tenantId: userId }, { ownerId: userId }, { proId: userId }],
  })
    .select('ticketId proId tenantId ownerId start end timezone status propertyAddress createdAt')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const userIds = new Set<string>();
  contracts.forEach(c => {
    if (c.landlord) userIds.add(String(c.landlord));
    if (c.tenant) userIds.add(String(c.tenant));
  });
  tickets.forEach(t => {
    if (t.proId) userIds.add(String(t.proId));
    if (t.ownerId) userIds.add(String(t.ownerId));
    if (t.openedBy) userIds.add(String(t.openedBy));
  });
  appointments.forEach(a => {
    if (a.proId) userIds.add(String(a.proId));
    if (a.tenantId) userIds.add(String(a.tenantId));
    if (a.ownerId) userIds.add(String(a.ownerId));
  });

  const validUserIds = Array.from(userIds).filter(id => Types.ObjectId.isValid(id));
  const users = validUserIds.length
    ? await User.find({ _id: { $in: validUserIds } }).select('name email role').lean()
    : [];

  const propertyIds = contracts
    .map((c: any) => (c.property?._id ? String(c.property._id) : c.property ? String(c.property) : ''))
    .filter(id => Types.ObjectId.isValid(id))
    .map(id => new Types.ObjectId(id));
  const properties = propertyIds.length
    ? await Property.find({ _id: { $in: propertyIds } }).select('title address city').lean()
    : [];

  return {
    now: new Date().toISOString(),
    contracts,
    payments,
    rentPayments,
    tickets,
    appointments,
    users,
    properties,
  };
}

export async function answerWithClara(query: string, platformContext: Record<string, unknown>) {
  const normalized = query.trim().toLowerCase();
  const isGreeting = /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|hi|hello)\b/.test(normalized);
  if (isGreeting) {
    return {
      answer:
        'Hola, soy Clara. Puedo ayudarte con contratos, pagos, incidencias y citas. ' +
        'Por ejemplo: “¿Cuándo finaliza mi contrato?” o “¿Debo algún pago?”.',
    };
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    const err = new Error('GOOGLE_API_KEY no configurada');
    (err as any).status = 500;
    throw err;
  }

  let lauDoc = await getLatestLauDocument() as { versionDate?: string; url?: string; content?: string } | null;
  if (!lauDoc) {
    const result = await upsertLatestLauDocument();
    lauDoc = (result.doc || null) as { versionDate?: string; url?: string; content?: string } | null;
  }

  const lauExcerpts = lauDoc?.content ? extractLauSections(lauDoc.content, query) : [];
  const prompt = buildPrompt({
    query,
    platformContext,
    lauContext: {
      versionDate: lauDoc?.versionDate,
      url: lauDoc?.url,
      excerpts: lauExcerpts,
    },
  });

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const result = await model.generateContent(prompt);
  const text = result.response.text()?.trim();
  if (!text) {
    const err = new Error('Respuesta vacía del modelo');
    (err as any).status = 502;
    throw err;
  }
  return {
    answer: text,
    lau: lauDoc ? { versionDate: lauDoc.versionDate, url: lauDoc.url } : undefined,
  };
}
