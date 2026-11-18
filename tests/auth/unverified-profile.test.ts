import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { bearer } from '../utils/sessionToken';
import { User } from '../../src/models/user.model';
import { Verification } from '../../src/models/verification.model';

const USER_ID = '507f1f77bcf86cd799439011';

describe('perfil propio de una cuenta sin verificar', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  // En tests ALLOW_UNVERIFIED da por verificada la sesión; la cabecera deja decidir a la base
  let auth = '';
  beforeEach(async () => {
    auth = await bearer(USER_ID, 'tenant');
  });
  const as = (method: 'get' | 'put', url: string) =>
    request(app)[method](url).set('Authorization', auth).set('x-user-verified', 'false');

  it('ve y edita su perfil, pero no lo que exige identidad verificada', async () => {
    const me = await as('get', '/api/users/me').expect(200);
    expect(me.body).toMatchObject({ id: USER_ID, role: 'tenant', isVerified: false });

    const saved = await as('put', '/api/users/me')
      .send({ phone: ' 600123456 ', bio: 'Busco piso en Vigo', monthlyIncome: 1800 })
      .expect(200);
    expect(saved.body).toMatchObject({ phone: '600123456', bio: 'Busco piso en Vigo', monthlyIncome: 1800 });

    expect((await as('get', '/api/users/me/stats')).body).toEqual({ error: 'owner_not_verified' });
    expect((await as('get', '/api/contracts')).status).toBe(403);
  });

  it('da por verificada la cuenta con una verificación aprobada aunque isVerified siga en false', async () => {
    await Verification.create({ userId: USER_ID, status: 'verified', method: 'dni' });
    const me = await as('get', '/api/users/me').expect(200);
    expect(me.body.isVerified).toBe(true);
  });

  it('PUT /me usa la lista blanca: ni rol, ni nombre, ni identidad, ni tipos raros', async () => {
    await as('put', '/api/users/me')
      .send({ role: 'admin', name: 'Otro', isVerified: true, ratingAvg: 5, tokenVersion: 9 })
      .expect(200);
    const fresh = await User.findById(USER_ID).lean();
    expect(fresh).toMatchObject({ role: 'tenant', isVerified: false, ratingAvg: 0, tokenVersion: 0 });
    expect(fresh?.name).not.toBe('Otro');

    expect((await as('put', '/api/users/me').send({ bio: { texto: 'hola' } })).body).toEqual({ error: 'invalid_bio' });
    expect((await as('put', '/api/users/me').send({ monthlyIncome: -1 })).body).toEqual({ error: 'invalid_monthlyIncome' });
    expect((await as('put', '/api/users/me').send({ serviceCategory: 'magia' })).status).toBe(400);
    // '' o null borran el campo
    await as('put', '/api/users/me').send({ phone: '600123456' }).expect(200);
    const cleared = await as('put', '/api/users/me').send({ phone: '' }).expect(200);
    expect(cleared.body.phone).toBeUndefined();
  });
});
