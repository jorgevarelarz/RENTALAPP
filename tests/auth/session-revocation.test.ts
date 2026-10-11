import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
import { User } from '../../src/models/user.model';
import { hashResetToken } from '../../src/controllers/auth.controller';
import { resolveSocialUser } from '../../src/services/oauth.service';
import { getJwtSecret } from '../../src/utils/getJwtSecret';

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

const createUser = async (email: string, extra: Record<string, unknown> = {}) =>
  User.create({
    name: 'Ana',
    email,
    role: 'tenant',
    isVerified: true,
    passwordHash: await bcrypt.hash('password123', 10),
    ...extra,
  });

const loginToken = async (email: string, password = 'password123') => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
};

const me = (token: string) =>
  request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);

const resetWithNewPassword = async (userId: unknown, password: string) => {
  const raw = 'reset-token-de-prueba';
  await User.updateOne(
    { _id: userId },
    { resetToken: hashResetToken(raw), resetTokenExp: new Date(Date.now() + 60_000) },
  );
  const res = await request(app).post('/api/auth/reset').send({ token: raw, password });
  expect(res.status).toBe(200);
};

describe('Revocación de sesiones (A3)', () => {
  it('restablecer la contraseña invalida los tokens anteriores y los nuevos funcionan', async () => {
    const user = await createUser('ana@example.com');
    const oldToken = await loginToken('ana@example.com');
    expect((jwt.decode(oldToken) as any).tv).toBe(0);
    expect((await me(oldToken)).status).toBe(200);

    await resetWithNewPassword(user._id, 'nueva-clave-123');

    const rejected = await me(oldToken);
    expect(rejected.status).toBe(401);
    expect(rejected.body.code).toBe('session_expired');

    const newToken = await loginToken('ana@example.com', 'nueva-clave-123');
    expect((jwt.decode(newToken) as any).tv).toBe(1);
    expect((await me(newToken)).status).toBe(200);
  });

  it('los tokens emitidos antes del cambio (sin tv) siguen valiendo si no hubo restablecimiento', async () => {
    const user = await createUser('legacy@example.com');
    await User.collection.updateOne({ _id: user._id }, { $unset: { tokenVersion: '' } });
    const legacy = jwt.sign({ id: user._id, role: 'tenant', isVerified: true }, getJwtSecret(), {
      expiresIn: '7d',
    });
    expect((await me(legacy)).status).toBe(200);
  });

  it('vincular Google a una cuenta sin correo verificado cierra las sesiones del que la creó (A1)', async () => {
    await createUser('victima@example.com');
    const attackerToken = await loginToken('victima@example.com');
    expect((await me(attackerToken)).status).toBe(200);

    const linked = await resolveSocialUser(
      { provider: 'google', subject: 'google-sub-1', email: 'victima@example.com', emailVerified: true } as any,
      'login',
      'tenant',
    );
    expect(linked.tokenVersion).toBe(1);
    expect((await me(attackerToken)).status).toBe(401);
  });

  it('un token revocado no rompe las rutas públicas: se trata como anónimo', async () => {
    const user = await createUser('publica@example.com');
    const oldToken = await loginToken('publica@example.com');
    await resetWithNewPassword(user._id, 'nueva-clave-123');

    const res = await request(app).get('/api/properties').set('Authorization', `Bearer ${oldToken}`);
    expect(res.status).toBe(200);
  });

  it('tokenVersion no se puede cambiar desde la actualización del perfil', async () => {
    const user = await createUser('perfil@example.com');
    const token = await loginToken('perfil@example.com');
    await request(app)
      .patch(`/api/users/${user._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tokenVersion: 7, phone: '600000000' });
    const fresh = await User.findById(user._id).lean();
    expect(fresh?.tokenVersion).toBe(0);
  });
});
