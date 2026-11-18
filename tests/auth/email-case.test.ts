import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
import { User } from '../../src/models/user.model';
import { resolveSocialUser } from '../../src/services/oauth.service';

// request-reset responde antes de mandar el correo: espera a que el envío en segundo plano ocurra.
const waitForCall = async (spy: jest.SpyInstance, timeoutMs = 3000) => {
  const start = Date.now();
  while (spy.mock.calls.length === 0) {
    if (Date.now() - start > timeoutMs) throw new Error('sendEmail no se llamó');
    await new Promise((r) => setTimeout(r, 10));
  }
};
import * as email from '../../src/utils/email';

let app: any;
let mongo: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongo = await startMongoMemoryServer();
  process.env.MONGO_URL = mongo.getUri();
  process.env.NODE_ENV = 'test';
  await mongoose.connect(mongo.getUri());
  await User.init();
  const mod = await import('../../src/app');
  app = mod.app || mod.default;
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  jest.restoreAllMocks();
  await User.deleteMany({});
});

// Cuenta antigua guardada tal como se escribió al registrarse, antes de normalizar.
const legacyUser = async (address: string) =>
  User.create({
    name: 'Ana',
    email: address,
    role: 'tenant',
    isVerified: true,
    passwordHash: await bcrypt.hash('password123', 10),
  });

const register = (address: string) =>
  request(app)
    .post('/api/auth/register')
    .send({ name: 'Ana', email: address, password: 'password123', role: 'tenant' });

describe('Correo de la cuenta sin distinguir mayúsculas', () => {
  it('el registro guarda el correo en minúsculas', async () => {
    const res = await register('Ana.Garcia@Example.COM');
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('ana.garcia@example.com');
    const stored = await User.findOne({}).lean();
    expect(stored?.email).toBe('ana.garcia@example.com');
  });

  it('no deja registrar otra cuenta con el mismo correo en otras mayúsculas', async () => {
    await legacyUser('Ana@Example.com');
    const res = await register('ana@example.com');
    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(1);
  });

  it('entra con el correo en otras mayúsculas, también en cuentas antiguas', async () => {
    await legacyUser('Ana@Example.com');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();

    const registered = await register('Luis@Example.com');
    expect(registered.status).toBe(201);
    const again = await request(app)
      .post('/api/auth/login')
      .send({ email: 'LUIS@example.com', password: 'password123' });
    expect(again.status).toBe(200);
  });

  it('la recuperación de contraseña encuentra la cuenta antigua', async () => {
    const send = jest.spyOn(email, 'sendEmail').mockResolvedValue('sent');
    const user = await legacyUser('Ana@Example.com');
    const res = await request(app).post('/api/auth/request-reset').send({ email: 'ana@example.com' });
    expect(res.status).toBe(200);
    await waitForCall(send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe('Ana@Example.com');
    const stored = await User.findById(user._id).select('+resetToken').lean();
    expect(stored?.resetToken).toBeTruthy();
  });

  it('Google vincula la cuenta antigua en vez de crear una segunda', async () => {
    const user = await legacyUser('Ana@Example.com');
    await User.updateOne({ _id: user._id }, { emailVerifiedAt: new Date() });
    const linked = await resolveSocialUser(
      { provider: 'google', subject: 'g-ana', email: 'ana@example.com', emailVerified: true, name: 'Ana' },
      'register',
      'tenant',
    );
    expect(String(linked._id)).toBe(String(user._id));
    expect(await User.countDocuments()).toBe(1);
  });
});

describe('Token de una cuenta borrada', () => {
  it('deja de valer: 401 session_expired', async () => {
    await legacyUser('borrada@example.com');
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'borrada@example.com', password: 'password123' });
    const token = login.body.token as string;
    await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200);

    await User.deleteMany({});
    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('session_expired');
  });
});
