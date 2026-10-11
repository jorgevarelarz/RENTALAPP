import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
import { User } from '../../src/models/user.model';
import { kycReturnUrl } from '../../src/routes/identity.routes';

let app: any;
let mongo: MongoMemoryServer | undefined;
const prevEnv = { ...process.env };

beforeAll(async () => {
  mongo = await startMongoMemoryServer();
  process.env.MONGO_URL = mongo.getUri();
  process.env.NODE_ENV = 'test';
  process.env.FRONTEND_URL = 'https://app.rentalapp.es';
  delete process.env.ALLOW_TEST_AUTH;
  delete process.env.ALLOW_UNVERIFIED;
  await mongoose.connect(mongo.getUri());
  const mod = await import('../../src/app');
  app = mod.app || mod.default;
});

afterAll(async () => {
  process.env = prevEnv;
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

const loginToken = async (email: string) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  expect(res.status).toBe(200);
  return res.body.token as string;
};

const get = (path: string, token: string) =>
  request(app).get(path).set('Authorization', `Bearer ${token}`);

describe('Rol y verificación leídos de la base en cada petición', () => {
  it('un administrador degradado pierde el acceso sin esperar a que caduque el token', async () => {
    const admin = await createUser('admin@example.com', { role: 'admin' });
    const token = await loginToken('admin@example.com');
    expect((await get('/api/users', token)).status).toBe(200);

    await User.updateOne({ _id: admin._id }, { role: 'tenant' });

    expect((await get('/api/users', token)).status).toBe(403);
    const me = await get('/api/users/me', token);
    expect(me.status).toBe(200);
    expect(me.body.role).toBe('tenant');
    expect(me.body.isVerified).toBe(true);
  });

  it('una verificación retirada se aplica en la siguiente petición', async () => {
    const user = await createUser('ana@example.com');
    const token = await loginToken('ana@example.com');
    expect((await get('/api/users/me', token)).status).toBe(200);

    await User.updateOne({ _id: user._id }, { isVerified: false });

    const res = await get('/api/users/me', token);
    expect(res.status).toBe(403);
  });

  it('una verificación concedida tras el login vale sin volver a entrar', async () => {
    const user = await createUser('luis@example.com', { isVerified: false });
    const token = await loginToken('luis@example.com');
    expect((await get('/api/users/me', token)).status).toBe(403);

    await User.updateOne({ _id: user._id }, { isVerified: true });

    const me = await get('/api/users/me', token);
    expect(me.status).toBe(200);
    expect(me.body.isVerified).toBe(true);
  });
});

describe('POST /api/kyc/start: destino de vuelta solo dentro del frontend', () => {
  it.each([
    [undefined, 'https://app.rentalapp.es/tenant/kyc'],
    ['/contracts/abc?deposit=1', 'https://app.rentalapp.es/contracts/abc?deposit=1'],
    ['https://evil.example/phish', 'https://app.rentalapp.es/tenant/kyc'],
    ['//evil.example', 'https://app.rentalapp.es/tenant/kyc'],
    ['/\\evil.example', 'https://app.rentalapp.es/tenant/kyc'],
    ['javascript:alert(1)', 'https://app.rentalapp.es/tenant/kyc'],
    [' /tenant/kyc\n', 'https://app.rentalapp.es/tenant/kyc'],
    [{ url: 'https://evil.example' }, 'https://app.rentalapp.es/tenant/kyc'],
  ])('%p → %s', (requested, expected) => {
    expect(kycReturnUrl(requested)).toBe(expected);
  });

  it('«/..//otro.dominio» no sale del dominio del frontend', () => {
    expect(new URL(kycReturnUrl('/..//evil.example/x')).origin).toBe('https://app.rentalapp.es');
  });

  it('la sesión de verificación lleva el destino saneado', async () => {
    await createUser('eva@example.com');
    const token = await loginToken('eva@example.com');
    const res = await request(app)
      .post('/api/kyc/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ returnUrl: 'https://evil.example/phish' });
    expect(res.status).toBe(200);
    const redirect = new URL(res.body.url).searchParams.get('redirect');
    expect(redirect).toBe('https://app.rentalapp.es/tenant/kyc');
  });
});
