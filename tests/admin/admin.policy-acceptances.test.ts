import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { sessionToken } from '../utils/sessionToken';
import { UserPolicyAcceptance } from '../../src/models/userPolicyAcceptance.model';
import { PolicyVersion } from '../../src/models/policy.model';
import { User } from '../../src/models/user.model';

const ADMIN = { _id: '507f1f77bcf86cd799439000', role: 'admin', isVerified: true };
const LAURA = '507f1f77bcf86cd799439010';
const PEDRO = '507f1f77bcf86cd799439011';

async function seed() {
  await User.create({ _id: LAURA, name: 'Laura', email: 'laura@example.com', role: 'tenant' });
  await PolicyVersion.create({ policyType: 'terms_of_service', version: 'v1.0', isActive: true });
  await PolicyVersion.create({ policyType: 'terms_of_service', version: 'v0.9', isActive: false });
  await PolicyVersion.create({ policyType: 'cookies_policy', version: 'v1.0', isActive: true });
  const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, '0')}T10:00:00Z`);
  await UserPolicyAcceptance.create([
    { userId: LAURA, policyType: 'terms_of_service', policyVersion: 'v0.9', acceptedAt: at(1) },
    { userId: LAURA, policyType: 'terms_of_service', policyVersion: 'v1.0', acceptedAt: at(2), userAgent: '=HYPERLINK("http://evil.example","clic")' },
    { userId: LAURA, policyType: 'cookies_policy', policyVersion: 'v1.0', acceptedAt: at(3) },
    { userId: PEDRO, policyType: 'terms_of_service', policyVersion: 'v1.0', acceptedAt: at(4) },
    // versión vigente de otra política: no debe colarse por compartir el número de versión
    { userId: PEDRO, policyType: 'cookies_policy', policyVersion: 'v0.9', acceptedAt: at(5) },
  ]);
}

describe('Admin policy acceptances API', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('solo para administradores, también el CSV', async () => {
    const tenant = await sessionToken({ _id: '507f1f77bcf86cd799439030', role: 'tenant' });
    await request(app).get('/api/admin/policies/acceptances').set('Authorization', `Bearer ${tenant}`).expect(403);
    await request(app).get('/api/admin/policies/acceptances/export.csv').set('Authorization', `Bearer ${tenant}`).expect(403);
  });

  it('pagina con total y filtra las versiones vigentes en la consulta', async () => {
    await seed();
    const auth = { Authorization: `Bearer ${await sessionToken(ADMIN)}` };

    const all = await request(app).get('/api/admin/policies/acceptances').query({ pageSize: 2 }).set(auth).expect(200);
    expect(all.body).toMatchObject({ total: 5, page: 1, pageSize: 2 });
    expect(all.body.data).toHaveLength(2);
    expect(all.body.data[0].acceptedAt).toBe('2026-10-05T10:00:00.000Z');

    const active = await request(app)
      .get('/api/admin/policies/acceptances')
      .query({ activeOnly: 'true', pageSize: 2, page: 2 })
      .set(auth)
      .expect(200);
    expect(active.body.total).toBe(3);
    expect(active.body.data).toHaveLength(1);
    expect(active.body.data[0]).toMatchObject({
      user: { id: LAURA, email: 'laura@example.com' },
      policyType: 'terms_of_service',
      policyVersion: 'v1.0',
    });

    const cookies = await request(app)
      .get('/api/admin/policies/acceptances')
      .query({ activeOnly: 'true', policyType: 'cookies_policy' })
      .set(auth)
      .expect(200);
    expect(cookies.body.total).toBe(1);
    expect(cookies.body.data[0].user.id).toBe(LAURA);

    const byUser = await request(app).get('/api/admin/policies/acceptances').query({ userId: PEDRO }).set(auth).expect(200);
    expect(byUser.body.total).toBe(2);
    expect(byUser.body.data[0].user.email).toBe('');

    const odd = await request(app).get('/api/admin/policies/acceptances').query({ page: 'abc', pageSize: '-3' }).set(auth).expect(200);
    expect(odd.body).toMatchObject({ page: 1, pageSize: 25, total: 5 });
  });

  it('sin versiones vigentes, activeOnly devuelve una lista vacía', async () => {
    await UserPolicyAcceptance.create({ userId: LAURA, policyType: 'terms_of_service', policyVersion: 'v1.0' });
    const auth = { Authorization: `Bearer ${await sessionToken(ADMIN)}` };
    const res = await request(app).get('/api/admin/policies/acceptances?activeOnly=true').set(auth).expect(200);
    expect(res.body).toMatchObject({ data: [], total: 0 });
  });

  it('rechaza ids mal formados, políticas desconocidas y operadores', async () => {
    await seed();
    const auth = { Authorization: `Bearer ${await sessionToken(ADMIN)}` };
    await request(app).get('/api/admin/policies/acceptances?userId[$ne]=x').set(auth).expect(400);
    const badUser = await request(app).get('/api/admin/policies/acceptances?userId=123').set(auth).expect(400);
    expect(badUser.body.error).toBe('invalid_user_id');
    const badType = await request(app).get('/api/admin/policies/acceptances?policyType=otra').set(auth).expect(400);
    expect(badType.body.error).toBe('invalid_policy_type');
    const csv = await request(app).get('/api/admin/policies/acceptances/export.csv?userId=nope').set(auth).expect(400);
    expect(csv.body.error).toBe('invalid_user_id');
  });

  it('el CSV sale del servidor con todas las filas del filtro y sin fórmulas', async () => {
    await seed();
    const auth = { Authorization: `Bearer ${await sessionToken(ADMIN)}` };
    const res = await request(app)
      .get('/api/admin/policies/acceptances/export.csv')
      .query({ activeOnly: 'true' })
      .set(auth)
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('aceptaciones-politicas.csv');
    const lines = res.text.split('\n');
    expect(lines[0]).toBe('"userId","email","policyType","policyVersion","acceptedAt","ip","userAgent"');
    expect(lines).toHaveLength(4);
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil.example"",""clic"")"`);
  });
});
