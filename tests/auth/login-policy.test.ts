import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
import { User } from '../../src/models/user.model';
import { hashResetToken, INVALID_CREDENTIALS } from '../../src/controllers/auth.controller';

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

const login = (email: string, password: string) =>
  request(app).post('/api/auth/login').send({ email, password });

describe('Login sin enumeración de cuentas', () => {
  it('responde igual si la cuenta no existe, es solo social o la contraseña falla', async () => {
    await User.create({ name: 'Social', email: 'social@example.com', role: 'tenant' });
    await User.create({
      name: 'Local',
      email: 'local@example.com',
      role: 'tenant',
      passwordHash: await bcrypt.hash('password123', 10),
    });

    const responses = await Promise.all([
      login('nadie@example.com', 'password123'),
      login('social@example.com', 'password123'),
      login('local@example.com', 'otra-clave-123'),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ message: INVALID_CREDENTIALS });
    }

    const ok = await login('local@example.com', 'password123');
    expect(ok.status).toBe(200);
    expect(ok.body.token).toEqual(expect.any(String));
  });
});

describe('Política de contraseñas', () => {
  it('el registro exige al menos 8 caracteres', async () => {
    const short = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana', email: 'ana@example.com', password: '1234567', role: 'tenant' });
    expect(short.status).toBe(400);
    expect(await User.countDocuments({ email: 'ana@example.com' })).toBe(0);

    const ok = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ana', email: 'ana@example.com', password: '12345678', role: 'tenant' });
    expect(ok.status).toBe(201);
  });

  it('el restablecimiento exige al menos 8 caracteres y no gasta el token', async () => {
    const user = await User.create({
      name: 'Reset',
      email: 'reset@example.com',
      role: 'tenant',
      passwordHash: await bcrypt.hash('password123', 10),
      resetToken: hashResetToken('tok-valido'),
      resetTokenExp: new Date(Date.now() + 60_000),
    });

    const short = await request(app).post('/api/auth/reset').send({ token: 'tok-valido', password: 'corta' });
    expect(short.status).toBe(400);
    const stored = await User.findById(user._id).select('+resetToken');
    expect(stored?.resetToken).toBe(hashResetToken('tok-valido'));

    const ok = await request(app).post('/api/auth/reset').send({ token: 'tok-valido', password: 'nueva-clave' });
    expect(ok.status).toBe(200);
  });
});

// Va al final: agota el límite por IP, compartido con login, registro y request-reset.
describe('Límite de intentos en /reset', () => {
  it('corta los intentos de adivinar tokens con 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const res = await request(app).post('/api/auth/reset').send({ token: `t${i}`, password: 'nueva-clave' });
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s !== 429).every((s) => s === 400)).toBe(true);
  });
});
