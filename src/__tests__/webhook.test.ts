import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startMongoMemoryServer } from './utils/mongoMemoryServer';
import ProcessedEvent from '../models/processedEvent.model';

let app: any;
let mongo: MongoMemoryServer | undefined;

jest.mock('../utils/stripe', () => {
  const stripeMock = {
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ client_secret: 'test_secret' }),
      capture: jest.fn().mockResolvedValue({ id: 'pi_test_capture' }),
    },
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test_1' }),
      createSource: jest.fn().mockResolvedValue({ id: 'src_test_1' }),
    },
    accounts: {
      create: jest.fn().mockResolvedValue({ id: 'acct_test_1' }),
      retrieve: jest.fn().mockResolvedValue({ charges_enabled: true, payouts_enabled: true, requirements: {} }),
    },
    accountLinks: {
      create: jest.fn().mockResolvedValue({ url: 'https://example.com/onboard' }),
    },
    webhooks: {
      constructEvent: jest.fn().mockImplementation((_body: any, _sig: string, _secret: string) => ({
        id: 'evt_test_1',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test_1', metadata: {} } },
      })),
    },
  };
  return {
    getStripeClient: jest.fn(() => stripeMock),
    isStripeConfigured: jest.fn(() => true),
    __resetStripeClientForTests: jest.fn(),
    __stripeMock: stripeMock,
  };
});

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
