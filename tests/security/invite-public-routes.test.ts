/**
 * Las invitaciones se abren sin sesión: el propietario invitado por una agencia y el
 * co-titular aún no tienen cuenta. app.ts monta varios app.use('/api', authenticate, …)
 * que corren en toda petición /api que llegue hasta ellos, así que estas rutas tienen que
 * ir antes. Hasta la ronda 75 iban después y respondían 401 «Token requerido»: los tests de
 * agencia y co-titulares no lo veían porque usan el atajo de cabeceras (ALLOW_TEST_AUTH).
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import { ContractParty } from '../../src/models/contractParty.model';
import { signAuthToken } from '../../src/utils/authToken';
import * as email from '../../src/utils/email';

let app: any;
const savedEnv: Record<string, string | undefined> = {};
const ENV_KEYS = ['ALLOW_TEST_AUTH', 'ALLOW_UNVERIFIED'];
const AUTH_REQUIRED = 'Token requerido';

beforeAll(async () => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  await connectDb();
  // Peticiones reales: ni usuario inventado por cabeceras ni verificación saltada
  process.env.ALLOW_TEST_AUTH = 'false';
  process.env.ALLOW_UNVERIFIED = 'false';
  const mod = await import('../../src/app');
  app = mod.app || mod.default;
});

afterEach(async () => {
  jest.restoreAllMocks();
  await clearDb();
});

afterAll(async () => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  await disconnectDb();
});

describe('invitación de agencia a propietario, sin sesión', () => {
  it('el propietario ve la invitación y crea su cuenta sin JWT', async () => {
    const agency = await User.create({
      name: 'Inmo Centro',
      email: 'agencia@test.com',
      passwordHash: 'hash',
      role: 'agency',
      isVerified: true,
    });
    const sendSpy = jest.spyOn(email, 'sendEmail').mockResolvedValue(undefined as any);

    await request(app)
      .post('/api/agency/landlords/invite')
      .set('Authorization', `Bearer ${signAuthToken(agency)}`)
      .send({ landlordName: 'Paco Prop', landlordEmail: 'paco@test.com', propertyAddress: 'Calle Real 1' })
      .expect(201);
    const html = String(sendSpy.mock.calls[sendSpy.mock.calls.length - 1][2]);
    const token = html.match(/\/invite\/([a-f0-9]+)/)![1];

    const preview = await request(app).get(`/api/agency-invites/${token}`);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ agencyName: 'Inmo Centro', landlordEmail: 'paco@test.com', status: 'invited' });

    const accept = await request(app)
      .post(`/api/agency-invites/${token}/accept`)
      .send({ password: 'supersegura1' });
    expect(accept.status).toBe(201);
    expect(accept.body.user).toMatchObject({ email: 'paco@test.com', role: 'landlord' });

    // La cuenta recién creada aún no está verificada: con su JWT puede volver a abrir el enlace
    const again = await request(app)
      .get(`/api/agency-invites/${token}`)
      .set('Authorization', `Bearer ${accept.body.token}`);
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('accepted');
  });

  it('un token que no existe da 404, no 401', async () => {
    const res = await request(app).get('/api/agency-invites/noexiste');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('invite_not_found');
  });

  it('aceptar sin contraseña da 400 del propio controlador', async () => {
    const res = await request(app).post('/api/agency-invites/noexiste/accept').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_payload');
  });
});

describe('vista previa de la invitación de co-titular, sin sesión', () => {
  it('devuelve el correo invitado y quién invita', async () => {
    const inviter = await User.create({
      name: 'Laura Inquilina',
      email: 'laura@test.com',
      passwordHash: 'hash',
      role: 'tenant',
      isVerified: true,
    });
    const token = 'token-cotitular-publico';
    await ContractParty.create({
      contractId: new mongoose.Types.ObjectId(),
      email: 'cotitular@test.com',
      status: 'INVITED',
      invitedByUserId: inviter._id,
      inviteTokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      inviteExpiresAt: new Date(Date.now() + 86400000),
    });

    const res = await request(app).get('/api/invites/preview').query({ token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: 'cotitular@test.com', expired: false, inviterName: 'Laura Inquilina' });
  });

  it('sin token da 400 del propio controlador', async () => {
    const res = await request(app).get('/api/invites/preview');
    expect(res.body.error).not.toBe(AUTH_REQUIRED);
    expect(res.status).toBe(400);
  });
});

describe('lo privado sigue pidiendo sesión', () => {
  const privateRoutes: Array<[string, string]> = [
    ['post', '/api/invites/accept'],
    ['get', '/api/users/me'],
    ['get', '/api/tickets'],
    ['get', '/api/chat/conversations'],
    ['get', '/api/agency/landlords'],
    ['post', '/api/agency/landlords/invite'],
    ['get', '/api/me/tenant-pro'],
    ['get', '/api/postsign/upsell/507f1f77bcf86cd799439011'],
    ['get', '/api/payments'],
    ['get', '/api/tax/report'],
  ];

  it.each(privateRoutes)('%s %s responde 401', async (method, path) => {
    const res = await (request(app) as any)[method](path).send({});
    expect(res.status).toBe(401);
  });
});
