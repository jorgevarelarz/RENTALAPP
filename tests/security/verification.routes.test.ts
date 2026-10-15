/**
 * /api/verification va detrás de authenticate (ronda 78). Antes se montaba sin sesión y cada
 * ruta se protegía por su cuenta: approve y reject solo tenían requireAdmin, que lee req.user,
 * y como nada lo rellenaba respondían 403 también al administrador. Peticiones reales, sin el
 * atajo de cabeceras de test.
 */

import request from 'supertest';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import { Verification } from '../../src/models/verification.model';
import { signAuthToken } from '../../src/utils/authToken';

let app: any;
const savedEnv: Record<string, string | undefined> = {};
const ENV_KEYS = ['ALLOW_TEST_AUTH', 'ALLOW_UNVERIFIED'];

const makeUser = (role: string, email: string) =>
  User.create({ name: role, email, passwordHash: 'hash', role, isVerified: role === 'admin' });

beforeAll(async () => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  await connectDb();
  process.env.ALLOW_TEST_AUTH = 'false';
  process.env.ALLOW_UNVERIFIED = 'false';
  const mod = await import('../../src/app');
  app = mod.app || mod.default;
});

afterEach(async () => {
  await clearDb();
});

afterAll(async () => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  await disconnectDb();
});

describe('/api/verification sin sesión', () => {
  it.each([
    ['get', '/api/verification/me'],
    ['post', '/api/verification/submit'],
    ['post', '/api/verification/000000000000000000000000/approve'],
    ['post', '/api/verification/000000000000000000000000/reject'],
    ['post', '/api/verification/dev/verify'],
  ])('%s %s responde 401', async (method, path) => {
    const res = await (request(app) as any)[method](path).send({});
    expect(res.status).toBe(401);
  });
});

describe('revisión del administrador', () => {
  it('el administrador aprueba y el usuario pasa requireVerified', async () => {
    const admin = await makeUser('admin', 'admin@test.com');
    const tenant = await makeUser('tenant', 'tenant@test.com');

    const res = await request(app)
      .post(`/api/verification/${tenant._id}/approve`)
      .set('Authorization', `Bearer ${signAuthToken(admin)}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('verified');

    const me = await request(app)
      .get('/api/verification/me')
      .set('Authorization', `Bearer ${signAuthToken(tenant)}`);
    expect(me.body.status).toBe('verified');
  });

  it('rechaza con notas y valida el usuario y el texto', async () => {
    const admin = await makeUser('admin', 'admin@test.com');
    const tenant = await makeUser('tenant', 'tenant@test.com');
    const auth = `Bearer ${signAuthToken(admin)}`;

    const ok = await request(app)
      .post(`/api/verification/${tenant._id}/reject`)
      .set('Authorization', auth)
      .send({ notes: '  La foto del DNI no se lee  ' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'rejected', notes: 'La foto del DNI no se lee' });

    const longNotes = await request(app)
      .post(`/api/verification/${tenant._id}/reject`)
      .set('Authorization', auth)
      .send({ notes: 'x'.repeat(501) });
    expect(longNotes.status).toBe(400);

    const badId = await request(app).post('/api/verification/abc/approve').set('Authorization', auth);
    expect(badId.status).toBe(404);
    const unknown = await request(app)
      .post('/api/verification/000000000000000000000000/approve')
      .set('Authorization', auth);
    expect(unknown.status).toBe(404);
    expect(await Verification.countDocuments({ userId: '000000000000000000000000' })).toBe(0);
  });

  it('un usuario que no es administrador recibe 403', async () => {
    const tenant = await makeUser('tenant', 'tenant@test.com');
    const res = await request(app)
      .post(`/api/verification/${tenant._id}/approve`)
      .set('Authorization', `Bearer ${signAuthToken(tenant)}`);
    expect(res.status).toBe(403);
    expect(await Verification.countDocuments()).toBe(0);
  });
});

describe('envío de documentos', () => {
  it('acepta ficheros propios de /uploads y deja la solicitud pendiente', async () => {
    const tenant = await makeUser('tenant', 'tenant@test.com');
    const res = await request(app)
      .post('/api/verification/submit')
      .set('Authorization', `Bearer ${signAuthToken(tenant)}`)
      .send({ method: 'dni', files: { idFrontUrl: '/uploads/abc123.jpg', idBackUrl: '/uploads/def456.jpg' } });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.files).toMatchObject({ idFrontUrl: '/uploads/abc123.jpg' });
  });

  it.each([
    [{ method: 'carnet', files: {} }, 'invalid_method'],
    [{ method: 'dni', files: { idFrontUrl: 'https://evil.example/x.jpg' } }, 'invalid_files'],
    [{ method: 'dni', files: { idFrontUrl: '/uploads/../../etc/passwd' } }, 'invalid_files'],
    [{ method: 'dni', files: { otherUrl: '/uploads/abc.jpg' } }, 'invalid_files'],
    [{ method: 'dni', files: ['/uploads/abc.jpg'] }, 'invalid_files'],
  ])('rechaza %j con %s', async (body, error) => {
    const tenant = await makeUser('tenant', 'tenant@test.com');
    const res = await request(app)
      .post('/api/verification/submit')
      .set('Authorization', `Bearer ${signAuthToken(tenant)}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
  });

  it('volver a enviar no quita una verificación aprobada', async () => {
    const tenant = await makeUser('tenant', 'tenant@test.com');
    await Verification.create({ userId: String(tenant._id), status: 'verified' });
    const res = await request(app)
      .post('/api/verification/submit')
      .set('Authorization', `Bearer ${signAuthToken(tenant)}`)
      .send({ method: 'dni', files: {} });
    expect(res.status).toBe(409);
    expect((await Verification.findOne({ userId: String(tenant._id) }).lean())?.status).toBe('verified');
  });
});
