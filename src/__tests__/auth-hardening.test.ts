import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app';
import Pro from '../models/pro.model';
import { getUserId } from '../utils/getUserId';
import { startMongoMemoryServer } from './utils/mongoMemoryServer';

let mongo: Awaited<ReturnType<typeof startMongoMemoryServer>> | null = null;

describe('Auth hardening', () => {
  beforeAll(async () => {
    mongo = await startMongoMemoryServer();
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_TEST_AUTH = 'true';
    process.env.ALLOW_UNVERIFIED = 'true';
    process.env.MONGO_URL = mongo.getUri();
    await mongoose.connect(mongo.getUri());
  });

  afterEach(async () => {
    const { collections } = mongoose.connection;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
    if (mongo) {
      await mongo.stop();
      mongo = null;
    }
  });

  it('ignores client-supplied verified when creating a PRO profile', async () => {
    const userId = '507f1f77bcf86cd799439099';

    const res = await request(app)
      .post('/api/pros')
      .set('x-user-id', userId)
      .set('x-user-role', 'pro')
      .set('x-user-verified', 'true')
      .send({
        displayName: 'Profesional demo',
        city: 'Madrid',
        services: [{ key: 'plumbing' }],
        verified: true,
      })
      .expect(201);

    expect(res.body.verified).toBe(false);

    const saved = await Pro.findOne({ userId }).lean();
    expect(saved?.verified).toBe(false);
  });

  it('does not trust x-user-id outside the test auth bypass', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevAllowTestAuth = process.env.ALLOW_TEST_AUTH;

    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_AUTH = 'false';

    try {
      expect(() =>
        getUserId({
          header: (name: string) => (name === 'x-user-id' ? '507f1f77bcf86cd799439011' : undefined),
        } as any),
      ).toThrow('Missing authenticated user identity');
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      process.env.ALLOW_TEST_AUTH = prevAllowTestAuth;
    }
  });
});
