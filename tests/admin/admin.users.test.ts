import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { sessionToken } from '../utils/sessionToken';
import { User } from '../../src/models/user.model';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';
const adminSession = () => sessionToken({ id: '507f1f77bcf86cd799439000', role: 'admin' });

describe('Admin users API', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('creates an agency user and returns email in the users list', async () => {
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${await adminSession()}`)
      .send({
        name: 'Inmo Norte',
        email: 'agency-admin@test.com',
        password: 'temporal123',
        role: 'agency',
        companyName: 'Inmo Norte SL',
      })
      .expect(201);

    expect(created.body.user.email).toBe('agency-admin@test.com');
    expect(created.body.user.role).toBe('agency');
    expect(created.body.user.isVerified).toBe(true);

    const list = await request(app)
      .get('/api/users?role=agency')
      .set('Authorization', `Bearer ${await adminSession()}`)
      .expect(200);

    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].email).toBe('agency-admin@test.com');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agency-admin@test.com', password: 'temporal123' })
      .expect(200);

    await request(app)
      .get('/api/agency/earnings/summary')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
  });

  it('rejects duplicate agency email', async () => {
    await User.create({
      name: 'Existing',
      email: 'agency-admin@test.com',
      passwordHash: 'hash',
      role: 'agency',
      isVerified: true,
    });

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${await adminSession()}`)
      .send({
        name: 'Inmo Norte',
        email: 'agency-admin@test.com',
        password: 'temporal123',
        role: 'agency',
      })
      .expect(409);
  });

  it('busca por nombre sin tildes, escapa la regex, ordena por alta y valida el rol', async () => {
    const base = { passwordHash: 'hash', isVerified: true };
    await User.create({ ...base, name: 'Ana Núñez', email: 'ana@test.com', role: 'tenant', createdAt: new Date('2026-01-01') });
    await User.create({ ...base, name: 'Bea Ruiz', email: 'bea@test.com', role: 'landlord', createdAt: new Date('2026-03-01') });
    await User.create({ ...base, name: 'Carlos', email: 'c+(a+)+@test.com', role: 'tenant', createdAt: new Date('2026-02-01') });
    const auth = `Bearer ${await adminSession()}`;

    // sessionToken crea la cuenta del administrador; se descarta al comparar
    const all = await request(app).get('/api/users?q=@test.com').set('Authorization', auth).expect(200);
    expect(all.body.items.filter((u: any) => u.role !== 'admin').map((u: any) => u.email)).toEqual(['bea@test.com', 'c+(a+)+@test.com', 'ana@test.com']);
    expect(all.body.items[0].passwordHash).toBeUndefined();

    const byName = await request(app).get('/api/users?q=nunez').set('Authorization', auth).expect(200);
    expect(byName.body.items.map((u: any) => u.email)).toEqual(['ana@test.com']);

    // Antes iba a $regex tal cual: «(a+)+» era un patrón, no texto
    const literal = await request(app).get('/api/users').query({ q: '(a+)+' }).set('Authorization', auth).expect(200);
    expect(literal.body.items.map((u: any) => u.email)).toEqual(['c+(a+)+@test.com']);

    // Ya no busca en el rol: «tenant» no está en ningún nombre ni correo
    const roleWord = await request(app).get('/api/users?q=tenant').set('Authorization', auth).expect(200);
    expect(roleWord.body.total).toBe(0);

    const bad = await request(app).get('/api/users?role=superuser').set('Authorization', auth).expect(400);
    expect(bad.body.error).toBe('invalid_role');
  });

  it('exporta en CSV todos los usuarios del filtro con fórmulas neutralizadas y solo para admin', async () => {
    await User.create({ name: '=HYPERLINK("http://x")', email: 'evil@test.com', passwordHash: 'h', role: 'tenant' });
    await User.create({ name: 'Inmo', email: 'inmo@test.com', passwordHash: 'h', role: 'agency', companyName: 'Inmo SL', isVerified: true });

    const res = await request(app)
      .get('/api/users/export.csv?role=tenant')
      .set('Authorization', `Bearer ${await adminSession()}`)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('usuarios.csv');
    const lines = res.text.split('\n');
    expect(lines[0]).toBe('"id","nombre","email","rol","empresa","verificado","alta"');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(lines[1]).toContain('"evil@test.com","tenant","","no"');
    expect(res.text).not.toContain('passwordHash');

    await request(app)
      .get('/api/users/export.csv?role=nope')
      .set('Authorization', `Bearer ${await adminSession()}`)
      .expect(400);

    const tenant = await sessionToken({ id: '507f1f77bcf86cd799439001', role: 'tenant' });
    await request(app).get('/api/users/export.csv').set('Authorization', `Bearer ${tenant}`).expect(403);
  });
});
