import fs from 'fs';
import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { sessionToken } from '../utils/sessionToken';
import { User } from '../../src/models/user.model';
import { ensureTenantProDir, encryptAndSaveTP, TENANT_PRO_DIR } from '../../src/services/tenantProStorage';

const ADMIN = { _id: '507f1f77bcf86cd799439000', role: 'admin', isVerified: true };
const LAURA = '507f1f77bcf86cd799439010';
const PDF = Buffer.from('%PDF-1.4\n%prueba\n');

async function seedPending() {
  const file = encryptAndSaveTP(PDF);
  const user: any = await User.create({
    _id: LAURA,
    name: 'Laura Martín',
    email: 'laura@example.com',
    role: 'tenant',
    tenantPro: {
      status: 'pending',
      consentAccepted: true,
      docs: [
        { type: 'nomina', url: file, status: 'pending', hash: 'abc' },
        { type: 'renta', status: 'pending', archivedAt: new Date() },
      ],
      auditTrail: [{ type: 'contrato', hash: 'def', status: 'approved' }],
    },
  } as any);
  return { file, docId: String(user.tenantPro.docs[0]._id), purgedId: String(user.tenantPro.docs[1]._id) };
}

describe('Revisión Tenant PRO del administrador', () => {
  let auth: Record<string, string>;

  beforeAll(async () => {
    process.env.TENANT_PRO_UPLOADS_KEY = 'b'.repeat(64);
    ensureTenantProDir();
    await connectDb();
  });
  beforeEach(async () => {
    auth = { Authorization: `Bearer ${await sessionToken(ADMIN)}` };
  });
  afterEach(clearDb);
  afterAll(async () => {
    fs.rmSync(TENANT_PRO_DIR, { recursive: true, force: true });
    await disconnectDb();
  });

  it('la lista de pendientes no expone el fichero cifrado, el hash ni el historial', async () => {
    await seedPending();
    const res = await request(app).get('/api/admin/tenant-pro/pending').set(auth).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: 'Laura Martín', email: 'laura@example.com' });
    const [doc, purged] = res.body[0].tenantPro.docs;
    expect(doc).toMatchObject({ type: 'nomina', status: 'pending', available: true });
    expect(doc.url).toBeUndefined();
    expect(doc.hash).toBeUndefined();
    expect(purged.available).toBe(false);
    expect(res.body[0].tenantPro.auditTrail).toBeUndefined();
  });

  it('abre el documento descifrado con su tipo, sin caché; 410 si se purgó', async () => {
    const { docId, purgedId } = await seedPending();
    const res = await request(app).get(`/api/admin/tenant-pro/${LAURA}/docs/${docId}`).set(auth).expect(200);
    expect(res.headers['content-type']).toMatch(/^application\/pdf/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-disposition']).toMatch(/^inline; filename="tenant-pro-nomina-/);
    expect(Buffer.from(res.body).toString('latin1')).toBe(PDF.toString('latin1'));

    await request(app).get(`/api/admin/tenant-pro/${LAURA}/docs/${purgedId}`).set(auth).expect(410, { error: 'doc_purged' });
    await request(app).get(`/api/admin/tenant-pro/${LAURA}/docs/507f1f77bcf86cd799439099`).set(auth).expect(404);
    await request(app).get(`/api/admin/tenant-pro/no-id/docs/${docId}`).set(auth).expect(400);

    const tenant = { Authorization: `Bearer ${await sessionToken({ _id: LAURA, role: 'tenant' })}` };
    await request(app).get(`/api/admin/tenant-pro/${LAURA}/docs/${docId}`).set(tenant).expect(403);
  });

  it('valida la decisión: tipo, renta máxima y que la solicitud siga pendiente', async () => {
    await seedPending();
    const url = `/api/admin/tenant-pro/${LAURA}/decision`;
    await request(app).post(url).set(auth).send({ decision: 'maybe' }).expect(400, { error: 'invalid_decision' });
    await request(app).post(url).set(auth).send({ decision: 'approved' }).expect(400, { error: 'invalid_max_rent' });
    await request(app).post(url).set(auth).send({ decision: 'approved', maxRent: -5 }).expect(400, { error: 'invalid_max_rent' });
    await request(app).post(url).set(auth).send({ decision: 'approved', maxRent: 'mil' }).expect(400, { error: 'invalid_max_rent' });
    await request(app).post('/api/admin/tenant-pro/no-id/decision').set(auth).send({ decision: 'rejected' }).expect(400);
    await request(app)
      .post('/api/admin/tenant-pro/507f1f77bcf86cd799439099/decision')
      .set(auth)
      .send({ decision: 'rejected' })
      .expect(404, { error: 'user_not_found' });

    await request(app).post(url).set(auth).send({ decision: 'approved', maxRent: 1450.4 }).expect(200);
    const u: any = await User.findById(LAURA).lean();
    expect(u.tenantPro).toMatchObject({ status: 'verified', maxRent: 1450 });

    // Un segundo clic (o rechazar después) no reescribe la decisión
    await request(app).post(url).set(auth).send({ decision: 'rejected' }).expect(409, { error: 'not_pending' });
    expect((await User.findById(LAURA).lean() as any).tenantPro.status).toBe('verified');
  });

  it('rechazar no necesita renta máxima', async () => {
    await seedPending();
    await request(app).post(`/api/admin/tenant-pro/${LAURA}/decision`).set(auth).send({ decision: 'rejected' }).expect(200);
    expect((await User.findById(LAURA).lean() as any).tenantPro).toMatchObject({ status: 'rejected', maxRent: 0 });
  });
});
