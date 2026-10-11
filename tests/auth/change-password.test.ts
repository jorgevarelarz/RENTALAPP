import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
import { User } from '../../src/models/user.model';

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
    // Sin identidad verificada: cambiar la contraseña no depende de ello.
    isVerified: false,
    passwordHash: await bcrypt.hash('password123', 10),
    ...extra,
  });

const loginToken = async (email: string, password = 'password123') => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
};

const changePassword = (token: string, body: Record<string, unknown>) =>
  request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send(body);

// La cuenta no está verificada: /api/users/me da 403 owner_not_verified con un token válido
// y 401 session_expired con uno revocado.
const sessionAccepted = async (token: string) =>
  (await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`)).status !== 401;

describe('POST /api/auth/change-password', () => {
  it('cambia la contraseña, cierra las demás sesiones y devuelve un token que sigue valiendo', async () => {
    await createUser('ana@example.com');
    const thisDevice = await loginToken('ana@example.com');
    const otherDevice = await loginToken('ana@example.com');

    const res = await changePassword(thisDevice, { currentPassword: 'password123', password: 'nueva-clave-123' });
    expect(res.status).toBe(200);
    expect((jwt.decode(res.body.token) as any).tv).toBe(1);

    // Los dos tokens anteriores quedan revocados; el nuevo sirve para seguir dentro.
    for (const old of [thisDevice, otherDevice]) {
      const rejected = await changePassword(old, { currentPassword: 'nueva-clave-123', password: 'otra-clave-456' });
      expect(rejected.status).toBe(401);
      expect(rejected.body.code).toBe('session_expired');
    }
    expect(await sessionAccepted(thisDevice)).toBe(false);
    expect(await sessionAccepted(res.body.token)).toBe(true);
    const again = await changePassword(res.body.token, { currentPassword: 'nueva-clave-123', password: 'otra-clave-456' });
    expect(again.status).toBe(200);

    expect((await request(app).post('/api/auth/login').send({ email: 'ana@example.com', password: 'password123' })).status).toBe(400);
    await loginToken('ana@example.com', 'otra-clave-456');
  });

  it('rechaza una contraseña actual incorrecta sin tocar la cuenta ni las sesiones', async () => {
    await createUser('ana@example.com');
    const token = await loginToken('ana@example.com');

    const res = await changePassword(token, { currentPassword: 'no-es-esta', password: 'nueva-clave-123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('wrong_password');

    const stored = await User.findOne({ email: 'ana@example.com' }).select('+passwordHash tokenVersion');
    expect(await bcrypt.compare('password123', stored!.passwordHash!)).toBe(true);
    expect(Number((stored as any).tokenVersion) || 0).toBe(0);
    expect(await sessionAccepted(token)).toBe(true);
  });

  it('aplica la política de contraseñas y rechaza repetir la actual', async () => {
    await createUser('ana@example.com');
    const token = await loginToken('ana@example.com');

    const short = await changePassword(token, { currentPassword: 'password123', password: 'corta' });
    expect(short.status).toBe(400);

    const same = await changePassword(token, { currentPassword: 'password123', password: 'password123' });
    expect(same.status).toBe(400);
    expect(same.body.error).toBe('same_password');
  });

  it('una cuenta de Google sin contraseña recibe password_not_set', async () => {
    const user = await createUser('google@example.com', { passwordHash: undefined, emailVerifiedAt: new Date() });
    const token = jwt.sign({ id: user._id, role: 'tenant', tv: 0 }, process.env.JWT_SECRET || 'insecure');

    const res = await changePassword(token, { currentPassword: 'cualquiera', password: 'nueva-clave-123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('password_not_set');
  });

  it('sin sesión da 401', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ currentPassword: 'password123', password: 'nueva-clave-123' });
    expect(res.status).toBe(401);
  });
});
