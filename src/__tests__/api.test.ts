import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app: any;
let mongo: MongoMemoryServer | undefined;

jest.mock('../utils/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ client_secret: 'test_secret' }),
    },
  },
}));

beforeAll(async () => {
  // Pin a modern MongoDB version on CI runners (OpenSSL 3)
  process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION || '7.0.5';
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongo.getUri();
  process.env.NODE_ENV = 'test';
  const mod = await import('../app');
  app = mod.app || mod.default;
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
});

describe('API basic flow', () => {
  let token = '';
  it('registers a user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'test@example.com', password: 'password', role: 'landlord' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  it('creates a property', async () => {
    const res = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Prop', description: 'Desc', price: 1000, address: 'Addr 1' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('published');
  });

  it('creates payment intent', async () => {
    const res = await request(app)
      .post('/api/payments/intent')
      .set('Authorization', `Bearer ${token}`)
      .send({ amountEUR: 1 });
    expect(res.status).toBe(200);
    expect(res.body.clientSecret).toBeDefined();
  });
});
