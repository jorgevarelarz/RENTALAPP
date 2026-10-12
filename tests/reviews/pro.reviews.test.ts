import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { bearer } from '../utils/sessionToken';
import { User } from '../../src/models/user.model';
import Pro from '../../src/models/pro.model';
import Ticket from '../../src/models/ticket.model';
import Review from '../../src/models/review.model';
import { reviewerLabel } from '../../src/routes/pro.routes';

const LANDLORD = '507f1f77bcf86cd799439011';
const TENANT = '507f1f77bcf86cd799439010';
const PRO = '507f1f77bcf86cd799439020';

describe('Opiniones del profesional', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  const seed = async (status = 'closed') => {
    await User.create({ _id: LANDLORD, name: 'Laura Martín Pérez', email: 'laura@test.com', role: 'landlord' });
    await User.create({ _id: TENANT, name: 'Iker', email: 'iker@test.com', role: 'tenant' });
    const pro = await Pro.create({ userId: PRO, displayName: 'Fontanería Ruiz', city: 'Madrid', services: [{ key: 'plumbing' }] });
    const ticket = await Ticket.create({
      contractId: 'x', openedBy: TENANT, ownerId: LANDLORD, proId: PRO,
      service: 'plumbing', title: 'Grifo', description: 'Gotea', status,
    });
    return { pro, ticket };
  };

  const post = async (from: string, role: string, body: Record<string, unknown>) =>
    request(app).post('/api/reviews').set('Authorization', await bearer(from, role)).send(body);

  it('la incidencia cerrada dice si puedes valorar y, después, cuál fue tu opinión', async () => {
    const { ticket } = await seed();
    const auth = await bearer(LANDLORD, 'landlord');

    const before = await request(app).get(`/api/tickets/${ticket._id}`).set('Authorization', auth).expect(200);
    expect(before.body.proReview).toEqual({ canReview: true, mine: null });

    expect((await post(LANDLORD, 'landlord', {
      toUserId: PRO, roleContext: 'pro', relatedId: String(ticket._id), score: 4, comment: '  Rápido y limpio  ',
    })).status).toBe(201);

    const after = await request(app).get(`/api/tickets/${ticket._id}`).set('Authorization', auth).expect(200);
    expect(after.body.proReview.canReview).toBe(false);
    expect(after.body.proReview.mine).toMatchObject({ score: 4, comment: 'Rápido y limpio' });

    // El profesional no se valora a sí mismo
    const asPro = await request(app).get(`/api/tickets/${ticket._id}`).set('Authorization', await bearer(PRO, 'pro')).expect(200);
    expect(asPro.body.proReview).toBeUndefined();
  });

  it('una incidencia sin cerrar no ofrece valorar', async () => {
    const { ticket } = await seed('awaiting_validation');
    const res = await request(app).get(`/api/tickets/${ticket._id}`).set('Authorization', await bearer(TENANT, 'tenant')).expect(200);
    expect(res.body.proReview).toBeUndefined();
  });

  it('la ficha pública lista las opiniones con nombre abreviado, sin ids ni correos', async () => {
    const { pro, ticket } = await seed();
    expect((await post(LANDLORD, 'landlord', { toUserId: PRO, roleContext: 'pro', relatedId: String(ticket._id), score: 5, comment: 'Muy bien' })).status).toBe(201);
    expect((await post(TENANT, 'tenant', { toUserId: PRO, roleContext: 'pro', relatedId: String(ticket._id), score: 3 })).status).toBe(201);

    const res = await request(app).get(`/api/pros/${pro._id}/reviews`).set('Authorization', await bearer(TENANT, 'tenant')).expect(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((i: any) => i.author).sort()).toEqual(['Iker', 'Laura M.']);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(LANDLORD);
    expect(body).not.toContain('@test.com');

    await request(app).get('/api/pros/no-es-un-id/reviews').set('Authorization', await bearer(TENANT, 'tenant')).expect(404);
  });

  it('dos opiniones a la vez cuentan las dos en la media', async () => {
    const { ticket } = await seed();
    const body = (score: number) => ({ toUserId: PRO, roleContext: 'pro', relatedId: String(ticket._id), score });
    const [a, b] = await Promise.all([post(LANDLORD, 'landlord', body(5)), post(TENANT, 'tenant', body(2))]);
    expect([a.status, b.status]).toEqual([201, 201]);
    const pro = await Pro.findOne({ userId: PRO }).lean();
    expect(pro?.reviewCount).toBe(2);
    expect(pro?.ratingAvg).toBe(3.5);
  });

  it('rechaza un comentario que no es texto', async () => {
    const { ticket } = await seed();
    expect((await post(LANDLORD, 'landlord', {
      toUserId: PRO, roleContext: 'pro', relatedId: String(ticket._id), score: 4, comment: { $gt: '' },
    })).status).toBe(400);
    expect(await Review.countDocuments()).toBe(0);
  });

  it('reviewerLabel abrevia el apellido', () => {
    expect(reviewerLabel('laura martín')).toBe('laura M.');
    expect(reviewerLabel('  ')).toBe('Usuario de RentalApp');
    expect(reviewerLabel(undefined)).toBe('Usuario de RentalApp');
  });
});
