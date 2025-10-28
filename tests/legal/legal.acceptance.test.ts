import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
import { User } from '../../src/models/user.model';
import { LegalDocument } from '../../src/models/legalDocument.model';

let app: any;
let mongo: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongo = await startMongoMemoryServer();
  process.env.MONGO_URL = mongo.getUri();
  process.env.NODE_ENV = 'test';
  const mod = await import('../../src/app');
  app = mod.app || mod.default;
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
});

afterEach(async () => {
  await Promise.all([User.deleteMany({}), LegalDocument.deleteMany({})]);
});

describe('Legal acceptance', () => {
  it('updates user acceptance with latest version', async () => {
    const user = await User.create({
      name: 'Tester',
      email: 'tester@example.com',
      passwordHash: 'hash',
      role: 'tenant',
      isVerified: true,
    } as any);

    await LegalDocument.create({ slug: 'terms', version: 'v2', content: 'Contenido v2' });

    const res = await request(app)
      .post('/api/legal/accept')
      .set('x-user-id', String(user._id))
      .set('x-user-role', 'tenant')
      .set('x-user-verified', 'true')
      .send({ slug: 'terms', version: 'v2' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, slug: 'terms', version: 'v2' });

    const refreshed = await User.findById(user._id).lean();
    expect(refreshed?.termsVersionAccepted).toBe('v2');
    expect(refreshed?.legalVersion).toBe('v2');
    expect(refreshed?.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it('rejects outdated versions', async () => {
    const user = await User.create({
      name: 'Tester',
      email: 'tester2@example.com',
      passwordHash: 'hash',
      role: 'tenant',
      isVerified: true,
    } as any);

    await LegalDocument.create({ slug: 'privacy', version: 'v3', content: 'Contenido v3' });

    const res = await request(app)
      .post('/api/legal/accept')
      .set('x-user-id', String(user._id))
      .set('x-user-role', 'tenant')
      .set('x-user-verified', 'true')
      .send({ slug: 'privacy', version: 'v2' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('outdated_version');
  });
});
