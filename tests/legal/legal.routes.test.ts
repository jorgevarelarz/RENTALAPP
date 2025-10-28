import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
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
  await LegalDocument.deleteMany({});
});

describe('Legal routes', () => {
  it('returns current terms content', async () => {
    const res = await request(app).get('/api/legal/terms');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ slug: 'terms', version: 'v1' });
    expect(typeof res.body.content).toBe('string');
    expect(res.body.content.length).toBeGreaterThan(10);
  });

  it('returns current privacy policy content', async () => {
    const res = await request(app).get('/api/legal/privacy');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ slug: 'privacy', version: 'v1' });
    expect(res.body.content).toContain('Política de Privacidad');
  });

  it('allows admin to create new legal version', async () => {
    const payload = { version: 'v2', content: 'Nuevo documento legal con el contenido requerido.' };
    const res = await request(app)
      .post('/api/legal/admin/terms')
      .set('x-user-id', '000000000000000000000001')
      .set('x-user-role', 'admin')
      .set('x-user-verified', 'true')
      .send(payload);
    expect(res.status).toBe(201);
    expect(res.body?.doc?.version).toBe('v2');

    const latest = await request(app).get('/api/legal/terms');
    expect(latest.body.version).toBe('v2');
    expect(latest.body.content).toContain('Nuevo documento legal');

    const history = await request(app)
      .get('/api/legal/admin/terms')
      .set('x-user-id', '000000000000000000000001')
      .set('x-user-role', 'admin')
      .set('x-user-verified', 'true');
    expect(history.status).toBe(200);
    expect(Array.isArray(history.body.items)).toBe(true);
    expect(history.body.items[0].version).toBe('v2');
  });

  it('rejects non admin attempts to publish', async () => {
    const res = await request(app)
      .post('/api/legal/admin/privacy')
      .set('x-user-id', '000000000000000000000002')
      .set('x-user-role', 'tenant')
      .set('x-user-verified', 'true')
      .send({ version: 'v2', content: 'Intento no autorizado' });
    expect(res.status).toBe(403);
  });
});
