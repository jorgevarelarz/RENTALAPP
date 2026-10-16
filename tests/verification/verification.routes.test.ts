import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { sessionToken } from '../utils/sessionToken';
import { User } from '../../src/models/user.model';
import { Verification } from '../../src/models/verification.model';

const ADMIN = { _id: '507f1f77bcf86cd799439000', role: 'admin', isVerified: true };
const LAURA = '507f1f77bcf86cd799439010';

async function withoutTestAuth<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.ALLOW_TEST_AUTH;
  process.env.ALLOW_TEST_AUTH = 'false';
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.ALLOW_TEST_AUTH;
    else process.env.ALLOW_TEST_AUTH = prev;
  }
}

describe('API de verificación de identidad', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('sin sesión todas las rutas dan 401, también las de administrador', async () => {
    await withoutTestAuth(async () => {
      await request(app).post(`/api/verification/${LAURA}/approve`).expect(401);
      await request(app).post(`/api/verification/${LAURA}/reject`).send({ notes: 'x' }).expect(401);
      await request(app).post('/api/verification/dev/verify').expect(401);
    });
    expect(await Verification.countDocuments()).toBe(0);
  });

  it('el administrador aprueba y rechaza; otro rol recibe 403', async () => {
    await User.create({ _id: LAURA, name: 'Laura', email: 'laura@example.com', role: 'tenant' });
    const tenant = { Authorization: `Bearer ${await sessionToken({ _id: LAURA, role: 'tenant' })}` };
    const admin = { Authorization: `Bearer ${await sessionToken(ADMIN)}` };

    await request(app).post(`/api/verification/${LAURA}/approve`).set(tenant).expect(403);
    expect(await Verification.countDocuments()).toBe(0);

    const ok = await request(app).post(`/api/verification/${LAURA}/approve`).set(admin).expect(200);
    expect(ok.body).toMatchObject({ userId: LAURA, status: 'verified' });

    // notes que no es texto se guarda vacío
    const noText = await request(app).post(`/api/verification/${LAURA}/reject`).set(admin).send({ notes: ['a'] }).expect(200);
    expect(noText.body).toMatchObject({ status: 'rejected', notes: '' });

    const withNotes = await request(app)
      .post(`/api/verification/${LAURA}/reject`)
      .set(admin)
      .send({ notes: 'La foto del DNI no se lee' })
      .expect(200);
    expect(withNotes.body).toMatchObject({ status: 'rejected', notes: 'La foto del DNI no se lee' });
  });

  it('un id mal formado da 400 y un usuario que no existe, 404, sin crear registros', async () => {
    const admin = { Authorization: `Bearer ${await sessionToken(ADMIN)}` };
    await request(app).post('/api/verification/no-es-un-id/approve').set(admin).expect(400, { error: 'invalid_user_id' });
    await request(app)
      .post('/api/verification/507f1f77bcf86cd799439099/reject')
      .set(admin)
      .expect(404, { error: 'user_not_found' });
    expect(await Verification.countDocuments()).toBe(0);
  });
});
