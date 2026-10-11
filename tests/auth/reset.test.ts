import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
import { User } from '../../src/models/user.model';
import * as email from '../../src/utils/email';
import { hashResetToken } from '../../src/controllers/auth.controller';

let app: any;
let mongo: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongo = await startMongoMemoryServer();
  process.env.MONGO_URL = mongo.getUri();
  process.env.NODE_ENV = 'test';
  await mongoose.connect(mongo.getUri());
  const mod = await import('../../src/app');
  app = mod.app || mod.default;
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Password reset flow', () => {
  it('request-reset devuelve 200 aunque el email no exista', async () => {
    const res = await request(app).post('/api/auth/request-reset').send({ email: 'ghost@example.com' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('guarda solo el hash del token y envía un enlace al frontend configurado', async () => {
    process.env.FRONTEND_URL = 'https://app.example.test/';
    const sendSpy = jest.spyOn(email, 'sendEmail').mockResolvedValue(undefined);
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash,
      role: 'tenant',
    });

    const res = await request(app).post('/api/auth/request-reset').send({ email: user.email });
    expect(res.status).toBe(200);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const html = String(sendSpy.mock.calls[0][2]);
    const match = html.match(/https:\/\/app\.example\.test\/reset\?token=([a-f0-9]{64})/);
    expect(match).not.toBeNull();
    expect(html).not.toContain('https://frontend/');
    const token = match![1];

    const updated = await User.findById(user._id).select('+resetToken +resetTokenExp');
    expect(updated?.resetToken).toBe(hashResetToken(token));
    expect(updated?.resetToken).not.toBe(token);
    expect(updated!.resetTokenExp!.getTime()).toBeGreaterThan(Date.now());

    // Por defecto el token no sale en las consultas.
    const plain = await User.findById(user._id).lean();
    expect((plain as any).resetToken).toBeUndefined();

    const reset = await request(app)
      .post('/api/auth/reset')
      .send({ token, password: 'newpassword' });
    expect(reset.status).toBe(200);

    // Un solo uso.
    const again = await request(app)
      .post('/api/auth/reset')
      .send({ token, password: 'otherpassword' });
    expect(again.status).toBe(400);
    delete process.env.FRONTEND_URL;
  });

  it('no acepta el hash guardado como si fuera el token', async () => {
    const user = await User.create({
      name: 'Hash User',
      email: 'hash@example.com',
      passwordHash: await bcrypt.hash('oldpassword', 10),
      role: 'tenant',
      resetToken: hashResetToken('secreto'),
      resetTokenExp: new Date(Date.now() + 60 * 60 * 1000),
    });

    const res = await request(app)
      .post('/api/auth/reset')
      .send({ token: hashResetToken('secreto'), password: 'newpassword' });
    expect(res.status).toBe(400);
    const stored = await User.findById(user._id).select('+passwordHash');
    expect(await bcrypt.compare('oldpassword', stored!.passwordHash as string)).toBe(true);
  });

  it('permite cambiar la contraseña con un token válido', async () => {
    const passwordHash = await bcrypt.hash('oldpassword', 10);
    const user = await User.create({
      name: 'Reset User',
      email: 'reset@example.com',
      passwordHash,
      role: 'tenant',
    });
    user.resetToken = hashResetToken('validtoken');
    user.resetTokenExp = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const res = await request(app)
      .post('/api/auth/reset')
      .send({ token: 'validtoken', password: 'newpassword' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const updated = await User.findById(user._id).select('+passwordHash +resetToken +resetTokenExp');
    expect(updated?.resetToken).toBeFalsy();
    expect(updated?.resetTokenExp).toBeFalsy();
    expect(await bcrypt.compare('newpassword', updated!.passwordHash as string)).toBe(true);
  });

  it('rechaza tokens inválidos o expirados', async () => {
    const passwordHash = await bcrypt.hash('anotherpassword', 10);
    const user = await User.create({
      name: 'Expired User',
      email: 'expired@example.com',
      passwordHash,
      role: 'tenant',
    });
    user.resetToken = hashResetToken('expiredtoken');
    user.resetTokenExp = new Date(Date.now() - 1000);
    await user.save();

    const res = await request(app)
      .post('/api/auth/reset')
      .send({ token: 'expiredtoken', password: 'newpass' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
