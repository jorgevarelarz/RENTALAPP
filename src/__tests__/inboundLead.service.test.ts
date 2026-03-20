import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startMongoMemoryServer } from './utils/mongoMemoryServer';
import Lead from '../models/lead.model';
import {
  analyzeInboundLead,
  inferConversationStageForLeadDoc,
} from '../services/inboundLead.service';

let mongo: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongo = await startMongoMemoryServer();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await Lead.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
});

describe('inboundLead.service', () => {
  it('separa owner details pending del lead status comercial', async () => {
    const result = await analyzeInboundLead({
      externalLeadId: 'test-owner-1',
      message: 'Quiero vender mi piso en Chamberi por 450000 euros.',
    });

    expect(result.leadType).toBe('OWNER');
    expect(result.leadStatus).toBe('PARTIALLY_QUALIFIED');
    expect(result.conversationStage).toBe('OWNER_DETAILS_PENDING');
    expect(result.suggestedQuestions).toContain('¿Tienes fotos disponibles?');
    expect(result.missingFields).toContain('squareMeters');
    expect(result.scoreReasons).toContain('Incluye ciudad o zona');
  });

  it('marca financing pending para buyer si falta financiacion', async () => {
    const result = await analyzeInboundLead({
      externalLeadId: 'test-buyer-1',
      message: 'Busco comprar. Zona Salamanca. Presupuesto 500000 euros. Quiero 3 habitaciones.',
    });

    expect(result.leadType).toBe('BUYER');
    expect(result.conversationStage).toBe('FINANCING_PENDING');
    expect(result.suggestedQuestions).toContain('¿Necesitas financiación?');
    expect(result.missingFields).toContain('financing');
    expect(result.missingFields).toContain('urgency');
  });

  it('evoluciona el mismo lead en multi-turn usando externalLeadId consistente', async () => {
    const first = await analyzeInboundLead({
      externalLeadId: 'multi-turn-lead',
      message: 'Quiero vender mi piso en Retiro por 600000 euros.',
    });

    const second = await analyzeInboundLead({
      externalLeadId: 'multi-turn-lead',
      message: 'Tiene 120 metros, 4 habitaciones y ya tengo fotos y documentación.',
    });

    expect(String(first.lead._id)).toBe(String(second.lead._id));
    expect(second.lead.messageCount).toBe(2);
    expect(second.conversationStage).toBe('READY_FOR_FOLLOWUP');
    expect(second.changes.qualificationScore?.previous).toBe(first.qualificationScore);
    expect(second.changes.newExtractedFields).toEqual(
      expect.arrayContaining(['squareMeters', 'bedrooms', 'hasPhotos', 'hasDocumentation']),
    );
    expect(second.lead.timeline).toHaveLength(4);
  });

  it('no avanza un lead cerrado salvo que el mensaje indique reapertura', async () => {
    const closed = await analyzeInboundLead({
      externalLeadId: 'closed-lead',
      message: 'Perfecto, ya está cerrado y firmado.',
    });
    const locked = await analyzeInboundLead({
      externalLeadId: 'closed-lead',
      message: 'Solo te escribo para confirmar gracias.',
    });
    const reopened = await analyzeInboundLead({
      externalLeadId: 'closed-lead',
      message: 'Quiero reabrir la operación porque seguimos interesados.',
    });

    expect(closed.leadStatus).toBe('CLOSED');
    expect(locked.leadStatus).toBe('CLOSED');
    expect(locked.nextBestAction).toMatch(/cerrado o descartado/i);
    expect(reopened.leadStatus).not.toBe('CLOSED');
  });

  it('permite awaiting user reply como etapa conversacional independiente', () => {
    const stage = inferConversationStageForLeadDoc({
      leadType: 'BUYER',
      extractedData: { zone: 'Retiro', budgetMax: 700000, bedrooms: 2, financingNeeded: true },
      awaitingUserReply: true,
      lastInboundMessage: 'Perfecto, quedo pendiente.',
    } as any);

    expect(stage).toBe('AWAITING_USER_REPLY');
  });
});
