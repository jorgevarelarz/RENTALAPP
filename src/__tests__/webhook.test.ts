import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startMongoMemoryServer } from './utils/mongoMemoryServer';
import ProcessedEvent from '../models/processedEvent.model';

let app: any;
let mongo: MongoMemoryServer | undefined;

jest.mock('../utils/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: jest.fn().mockImplementation((_body: any, _sig: string, _secret: string) => ({
        id: 'evt_test_1',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test_1', metadata: {} } },
      })),
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ client_secret: 'test_secret' }),
    },
  },
}));

beforeAll(async () => {
  mongo = await startMongoMemoryServer();
  process.env.MONGO_URL = mongo.getUri();
  process.env.NODE_ENV = 'test';
  process.env.ALLOW_UNVERIFIED = 'true';
  const mod = await import('../app');
  app = mod.app || mod.default;
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
});

describe('Stripe webhook idempotency', () => {
  it('processes an event once and ignores duplicates', async () => {
    const rawBody = Buffer.from(JSON.stringify({ any: 'payload' }));
    const headers = { 'Stripe-Signature': 't=1,v1=fake' } as any;

    const r1 = await request(app)
      .post('/api/stripe/webhook')
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(rawBody);
    expect(r1.status).toBe(200);

    const r2 = await request(app)
      .post('/api/stripe/webhook')
      .set(headers)
      .set('Content-Type', 'application/json')
      .send(rawBody);
    expect(r2.status).toBe(200);

    const count = await ProcessedEvent.countDocuments({ provider: 'stripe', eventId: 'evt_test_1' });
    expect(count).toBe(1);
  });
});

