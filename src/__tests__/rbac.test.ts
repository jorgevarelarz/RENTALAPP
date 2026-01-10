import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startMongoMemoryServer } from './utils/mongoMemoryServer';
import { app } from '../app';

let mongo: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongo = await startMongoMemoryServer();
  process.env.MONGO_URL = mongo.getUri();
  process.env.NODE_ENV = 'test';
  process.env.ALLOW_UNVERIFIED = 'true';
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
});

describe('RBAC basic matrix', () => {
  // 401 (use invalid token to bypass test fallback)
  it('returns 401 with invalid token on private route', async () => {
    const res = await request(app)
      .post('/api/properties/000000000000000000000001/archive')
      .set('Authorization', 'Bearer invalid')
      .send();
    expect(res.status).toBe(401);
  });

  // 403 cross role: tenant -> landlord-only
  it('tenant cannot access landlord-only route', async () => {
    const res = await request(app)
      .post('/api/properties/000000000000000000000001/archive')
      .set('x-user-id', '000000000000000000000002')
      .set('x-user-role', 'tenant')
      .send();
    expect(res.status).toBe(403);
  });

  // 403 cross: landlord -> admin-only (has requireAdmin)
  it('landlord cannot access admin-only route', async () => {
    const res = await request(app)
      .get('/api/admin/tenant-pro/pending')
      .set('x-user-id', '000000000000000000000003')
      .set('x-user-role', 'landlord');
    expect(res.status).toBe(403);
  });

  // 403 cross: pro -> tenant-only
  it('pro cannot access tenant-only route', async () => {
    const res = await request(app)
      .post('/api/properties/000000000000000000000004/apply')
      .set('x-user-id', '000000000000000000000004')
      .set('x-user-role', 'pro')
      .send();
    expect(res.status).toBe(403);
  });

  // 200 happy paths by role (endpoints that can return 200 without heavy setup)
  it('tenant can list own tickets', async () => {
    const res = await request(app)
      .get('/api/tickets/my/tenant')
      .set('x-user-id', '000000000000000000000010')
      .set('x-user-role', 'tenant');
    expect(res.status).toBe(200);
  });

  it('landlord can list own tickets', async () => {
    const res = await request(app)
      .get('/api/tickets/my/owner')
      .set('x-user-id', '000000000000000000000011')
      .set('x-user-role', 'landlord');
    expect(res.status).toBe(200);
  });

  it('pro can list own tickets', async () => {
    const res = await request(app)
      .get('/api/tickets/my/pro')
      .set('x-user-id', '000000000000000000000012')
      .set('x-user-role', 'pro');
    expect(res.status).toBe(200);
  });

  it('admin can view admin page', async () => {
    const res = await request(app)
      .get('/api/admin/tenant-pro/pending')
      .set('x-user-id', '000000000000000000000013')
      .set('x-user-role', 'admin')
      .set('x-admin', 'true');
    expect(res.status).toBe(200);
  });
});
