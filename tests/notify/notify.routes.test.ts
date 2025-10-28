import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';

let app: any;
let mongo: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongo = await startMongoMemoryServer();
  process.env.MONGO_URL = mongo.getUri();
  process.env.NODE_ENV = 'test';
  process.env.ALLOW_UNVERIFIED = 'true';
  const mod = await import('../../src/app');
  app = mod.app || mod.default;
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
});

describe('Notify routes hardening', () => {
  it('rechaza tokens inválidos', async () => {
    const res = await request(app)
      .post('/api/notify/email')
      .set('Authorization', 'Bearer invalid')
      .send({ to: 'user@example.com', subject: 'Hola', body: 'Mensaje' });
    expect(res.status).toBe(401);
  });

  it('bloquea peticiones sin rol permitido', async () => {
    const res = await request(app)
      .post('/api/notify/email')
      .set('x-user-role', 'guest')
      .set('x-user-verified', 'true')
      .send({ to: 'user@example.com', subject: 'Hola', body: 'Mensaje' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('No autorizado');
  });

  it('valida los parámetros antes de enviar email', async () => {
    const res = await request(app)
      .post('/api/notify/email')
      .set('x-user-role', 'admin')
      .set('x-user-verified', 'true')
      .send({ to: 'no-es-correo', subject: '', body: '' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('validation_error');
  });

  it('permite notificaciones cuando cumple requisitos', async () => {
    const res = await request(app)
      .post('/api/notify/email')
      .set('x-user-role', 'admin')
      .set('x-user-verified', 'true')
      .send({ to: 'user@example.com', subject: 'Hola', body: 'Mensaje' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('permite notificaciones para roles operativos', async () => {
    const res = await request(app)
      .post('/api/notify/email')
      .set('x-user-role', 'landlord')
      .set('x-user-verified', 'true')
      .send({ to: 'user@example.com', subject: 'Hola', body: 'Mensaje' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('valida formato de SMS', async () => {
    const fail = await request(app)
      .post('/api/notify/sms')
      .set('x-user-role', 'admin')
      .set('x-user-verified', 'true')
      .send({ to: '123', body: 'Mensaje' });
    expect(fail.status).toBe(400);

    const ok = await request(app)
      .post('/api/notify/sms')
      .set('x-user-role', 'admin')
      .set('x-user-verified', 'true')
      .send({ to: '+34699111222', body: 'Mensaje' });
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
  });
});
