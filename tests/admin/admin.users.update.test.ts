import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { bearer } from '../utils/sessionToken';
import { User } from '../../src/models/user.model';

const ADMIN_ID = '507f1f77bcf86cd799439000';

const createTarget = (extra: Record<string, unknown> = {}) =>
  User.create({ name: 'Lucía Pérez', email: 'lucia@test.com', passwordHash: 'h', role: 'tenant', ...extra });

describe('PATCH /api/users/:id con lista blanca', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('el administrador cambia nombre, correo normalizado, rol e identidad, pero no valoraciones ni tokens', async () => {
    const target = await createTarget();
    const res = await request(app)
      .patch(`/api/users/${target._id}`)
      .set('Authorization', await bearer(ADMIN_ID, 'admin'))
      .send({
        name: '  Lucía Pérez Gil ',
        email: '  Lucia.Nueva@Test.com ',
        role: 'landlord',
        isVerified: true,
        ratingAvg: 5,
        reviewCount: 99,
        tokenVersion: 7,
        stripeAccountId: 'acct_x',
        tenantPro: { status: 'verified', maxRent: 9000 },
      })
      .expect(200);

    expect(res.body).toMatchObject({ name: 'Lucía Pérez Gil', email: 'lucia.nueva@test.com', role: 'landlord', isVerified: true });
    const fresh = await User.findById(target._id).lean();
    expect(fresh).toMatchObject({ ratingAvg: 0, reviewCount: 0, tokenVersion: 0 });
    expect(fresh?.stripeAccountId).toBeUndefined();
    expect(fresh?.tenantPro?.status ?? 'none').toBe('none');
  });

  it('valida correo, rol, identidad y tipos', async () => {
    const target = await createTarget();
    await User.create({ name: 'Otra', email: 'otra@test.com', passwordHash: 'h', role: 'tenant' });
    const admin = await bearer(ADMIN_ID, 'admin');
    const patch = (body: Record<string, unknown>) =>
      request(app).patch(`/api/users/${target._id}`).set('Authorization', admin).send(body);

    expect((await patch({ email: 'OTRA@test.com' })).body).toEqual({ error: 'email_already_exists' });
    expect((await patch({ email: 'OTRA@test.com' })).status).toBe(409);
    expect((await patch({ email: 'no-es-correo' })).body.error).toBe('invalid_email');
    expect((await patch({ role: 'admin' })).body.error).toBe('invalid_role');
    expect((await patch({ role: 'superuser' })).body.error).toBe('invalid_role');
    expect((await patch({ isVerified: 'true' })).body.error).toBe('invalid_isVerified');
    expect((await patch({ name: '   ' })).body.error).toBe('invalid_name');
    expect((await patch({ monthlyIncome: -5 })).body.error).toBe('invalid_monthlyIncome');
    expect((await patch({ serviceCategory: 'magia' })).status).toBe(400);
    // Su propio correo con otras mayúsculas no es un duplicado
    expect((await patch({ email: 'LUCIA@test.com' })).status).toBe(200);

    const fresh = await User.findById(target._id).lean();
    expect(fresh).toMatchObject({ email: 'lucia@test.com', role: 'tenant', isVerified: false, name: 'Lucía Pérez' });
  });

  it('no cambia el rol de un administrador, tampoco el propio', async () => {
    const admin = await bearer(ADMIN_ID, 'admin');
    const res = await request(app)
      .patch(`/api/users/${ADMIN_ID}`)
      .set('Authorization', admin)
      .send({ role: 'tenant' })
      .expect(400);
    expect(res.body.error).toBe('role_locked');
    expect((await User.findById(ADMIN_ID).lean())?.role).toBe('admin');
  });

  it('cada cuenta edita solo su perfil: ni rol, ni identidad, ni correo, ni cuentas ajenas', async () => {
    const target = await createTarget();
    const self = await bearer(String(target._id), 'tenant');
    const res = await request(app)
      .patch(`/api/users/${target._id}`)
      .set('Authorization', self)
      .send({ phone: ' 600 000 000 ', monthlyIncome: '2100', jobTitle: '', role: 'admin', isVerified: true, email: 'x@y.com', name: 'Otro' })
      .expect(200);
    expect(res.body).toMatchObject({ phone: '600 000 000', monthlyIncome: 2100, role: 'tenant', isVerified: false });

    const fresh = await User.findById(target._id).lean();
    expect(fresh).toMatchObject({ email: 'lucia@test.com', name: 'Lucía Pérez', role: 'tenant' });

    const other = await User.create({ name: 'Ajena', email: 'ajena@test.com', passwordHash: 'h', role: 'tenant' });
    await request(app).patch(`/api/users/${other._id}`).set('Authorization', self).send({ phone: '1' }).expect(403);
  });

  it('id mal formado da 400 y cuenta inexistente 404', async () => {
    const admin = await bearer(ADMIN_ID, 'admin');
    expect((await request(app).patch('/api/users/abc').set('Authorization', admin).send({ phone: '1' })).status).toBe(400);
    expect(
      (await request(app).patch('/api/users/507f1f77bcf86cd799439999').set('Authorization', admin).send({ phone: '1' })).status,
    ).toBe(404);
  });
});
