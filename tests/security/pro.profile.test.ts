import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { bearer } from '../utils/sessionToken';
import Pro from '../../src/models/pro.model';

const PRO = '507f1f77bcf86cd799439030';
const TENANT = '507f1f77bcf86cd799439031';

describe('Perfil profesional (/api/pros)', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('solo un profesional crea su perfil público', async () => {
    const res = await request(app)
      .post('/api/pros')
      .set('Authorization', await bearer(TENANT, 'tenant'))
      .send({ displayName: 'Falso', city: 'Madrid', services: [{ key: 'plumbing' }] });
    expect(res.status).toBe(403);
    expect(await Pro.countDocuments()).toBe(0);
  });

  it('guarda los datos limpios y permite pausar el perfil', async () => {
    const auth = await bearer(PRO, 'pro');
    const res = await request(app)
      .post('/api/pros')
      .set('Authorization', auth)
      .send({
        displayName: '  Reformas   García ',
        city: ' Madrid ',
        services: [{ key: 'plumbing', basePrice: 45.555 }, { key: 'painting', basePrice: '' }],
        verified: true,
        ratingAvg: 5,
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ displayName: 'Reformas García', city: 'Madrid', active: true, verified: false, ratingAvg: 0 });
    expect(res.body.services).toEqual([{ key: 'plumbing', basePrice: 45.56 }, { key: 'painting' }]);

    const paused = await request(app)
      .post('/api/pros')
      .set('Authorization', auth)
      .send({ displayName: 'Reformas García', city: 'Madrid', services: [], active: false });
    expect(paused.status).toBe(201);
    expect(paused.body.active).toBe(false);
    const list = await request(app).get('/api/pros').set('Authorization', await bearer(TENANT, 'tenant'));
    expect(list.body.total).toBe(0);
  });

  it.each([
    [{ displayName: ['Reformas', 'García'], city: 'Madrid' }, 'invalid_display_name'],
    [{ displayName: 'A', city: 'Madrid' }, 'invalid_display_name'],
    [{ displayName: 'Reformas', city: '' }, 'invalid_city'],
    [{ displayName: 'Reformas', city: 'Madrid', services: [{ key: 'hacking' }] }, 'invalid_services'],
    [{ displayName: 'Reformas', city: 'Madrid', services: [{ key: 'plumbing' }, { key: 'plumbing' }] }, 'invalid_services'],
    [{ displayName: 'Reformas', city: 'Madrid', services: [{ key: 'plumbing', basePrice: -1 }] }, 'invalid_services'],
    [{ displayName: 'Reformas', city: 'Madrid', services: [{ key: 'plumbing', basePrice: '50' }] }, 'invalid_services'],
    [{ displayName: 'Reformas', city: 'Madrid', active: 'no' }, 'invalid_active'],
  ])('rechaza datos no válidos (%j)', async (body, error) => {
    const res = await request(app).post('/api/pros').set('Authorization', await bearer(PRO, 'pro')).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
    expect(await Pro.countDocuments()).toBe(0);
  });

  it('un id mal formado da 404 sin detalles internos', async () => {
    const res = await request(app).get('/api/pros/no-es-un-id').set('Authorization', await bearer(TENANT, 'tenant'));
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not found');
  });
});
