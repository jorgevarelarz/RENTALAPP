import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { sessionToken } from '../utils/sessionToken';
import { SystemEvent } from '../../src/models/systemEvent.model';

const ADMIN = { _id: '507f1f77bcf86cd799439000', role: 'admin', isVerified: true };

async function seed() {
  // insertMany en la colección para fijar createdAt (los timestamps de Mongoose lo pisarían)
  await SystemEvent.collection.insertMany([
    { type: 'COMPLIANCE_RISK_CREATED', resourceType: 'contract', resourceId: 'c1', createdAt: new Date('2026-10-11T12:00:00Z') },
    { type: 'ADMIN_RATE_LIMIT_HIT', resourceType: 'admin', resourceId: 'a1', payload: { requestId: 'req-1' }, createdAt: new Date('2026-10-12T12:00:00Z') },
    { type: 'LISTING_PRICE_LIMIT_EXCEEDED', resourceType: 'property', resourceId: 'p1', createdAt: new Date('2026-10-13T12:00:00Z') },
  ]);
}

describe('Admin system events API', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('solo para administradores', async () => {
    const tenant = await sessionToken({ _id: '507f1f77bcf86cd799439030', role: 'tenant' });
    await request(app).get('/api/admin/system-events').set('Authorization', `Bearer ${tenant}`).expect(403);
  });

  it('«hasta» incluye el día entero y filtra por tipo y recurso', async () => {
    await seed();
    const token = await sessionToken(ADMIN);
    const auth = { Authorization: `Bearer ${token}` };

    const range = await request(app)
      .get('/api/admin/system-events')
      .query({ dateFrom: '2026-10-12', dateTo: '2026-10-12' })
      .set(auth)
      .expect(200);
    expect(range.body.data.total).toBe(1);
    expect(range.body.data.items[0].type).toBe('ADMIN_RATE_LIMIT_HIT');

    const byResource = await request(app)
      .get('/api/admin/system-events')
      .query({ resourceType: 'property' })
      .set(auth)
      .expect(200);
    expect(byResource.body.data.items.map((i: any) => i.resourceId)).toEqual(['p1']);

    const csv = await request(app)
      .get('/api/admin/system-events/export.csv')
      .query({ dateTo: '2026-10-12' })
      .set(auth)
      .expect(200);
    expect(csv.text.trim().split('\n')).toHaveLength(3); // cabecera + 2 eventos
  });

  it('fechas no válidas o al revés dan 400 y una página rara no rompe', async () => {
    await seed();
    const token = await sessionToken(ADMIN);
    const auth = { Authorization: `Bearer ${token}` };

    for (const query of [{ dateFrom: 'ayer' }, { dateFrom: '2026-10-13', dateTo: '2026-10-11' }]) {
      const res = await request(app).get('/api/admin/system-events').query(query).set(auth).expect(400);
      expect(res.body.error).toBe('invalid_date_range');
    }
    await request(app)
      .get('/api/admin/system-events/export.csv')
      .query({ dateTo: 'mañana' })
      .set(auth)
      .expect(400);

    const res = await request(app)
      .get('/api/admin/system-events')
      .query({ page: 'abc', pageSize: '0' })
      .set(auth)
      .expect(200);
    expect(res.body.data).toMatchObject({ page: 1, pageSize: 25, total: 3 });
  });
});
