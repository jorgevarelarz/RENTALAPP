import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';
import { User } from '../../src/models/user.model';
import ServiceOffer from '../../src/models/serviceOffer.model';
import Ticket from '../../src/models/ticket.model';
import Review from '../../src/models/review.model';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';
const token = (_id: string, role: string) => `Bearer ${jwt.sign({ _id, role }, JWT_SECRET)}`;

const LANDLORD = '507f1f77bcf86cd799439011';
const TENANT = '507f1f77bcf86cd799439010';
const STRANGER = '507f1f77bcf86cd799439030';
const PRO = '507f1f77bcf86cd799439020';

const review = (from: string, role: string, body: Record<string, unknown>) =>
  request(app).post('/api/reviews').set('Authorization', token(from, role)).send(body);

describe('Reseñas: solo entre partes de una relación real', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  const contract = (status: string) =>
    Contract.create({
      landlord: LANDLORD, tenant: TENANT, property: '507f1f77bcf86cd799439012',
      rent: 700, deposit: 700, startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000),
      region: 'general', clauses: [], status,
    });

  it('rechaza un relatedId inventado o que no es un id', async () => {
    await review(STRANGER, 'tenant', {
      toUserId: LANDLORD, roleContext: 'owner', relatedId: '507f1f77bcf86cd799439099', score: 1,
    }).expect(403);
    await review(STRANGER, 'tenant', {
      toUserId: LANDLORD, roleContext: 'owner', relatedId: 'cualquier-cosa', score: 1,
    }).expect(403);
    await review(STRANGER, 'tenant', {
      toUserId: LANDLORD, roleContext: 'owner', relatedId: { $ne: null }, score: 1,
    }).expect(400);
    expect(await Review.countDocuments()).toBe(0);
  });

  it('el inquilino reseña al casero de su contrato firmado, una sola vez, y actualiza la media', async () => {
    await User.create({ _id: LANDLORD, name: 'Casero', email: 'casero@test.com', role: 'landlord' });
    const c = await contract('active');
    const body = { toUserId: LANDLORD, roleContext: 'owner', relatedId: String(c._id), score: 4 };

    await review(TENANT, 'tenant', body).expect(201);
    await review(TENANT, 'tenant', body).expect(409);

    const landlord = await User.findById(LANDLORD).lean();
    expect(landlord?.reviewCount).toBe(1);
    expect(landlord?.ratingAvg).toBe(4);
  });

  it('el casero reseña al inquilino solo con roleContext tenant', async () => {
    const c = await contract('terminated');
    await review(LANDLORD, 'landlord', {
      toUserId: TENANT, roleContext: 'owner', relatedId: String(c._id), score: 5,
    }).expect(403);
    await review(LANDLORD, 'landlord', {
      toUserId: TENANT, roleContext: 'tenant', relatedId: String(c._id), score: 5,
    }).expect(201);
  });

  it('rechaza a terceros y contratos sin firmar', async () => {
    const active = await contract('active');
    await review(STRANGER, 'tenant', {
      toUserId: LANDLORD, roleContext: 'owner', relatedId: String(active._id), score: 0,
    }).expect(403);

    const draft = await contract('draft');
    await review(TENANT, 'tenant', {
      toUserId: LANDLORD, roleContext: 'owner', relatedId: String(draft._id), score: 0,
    }).expect(403);
  });

  it('a un profesional solo se le reseña con un servicio pagado o una incidencia cerrada', async () => {
    const offer = await ServiceOffer.create({
      conversationId: 'c1', proId: PRO, ownerId: LANDLORD, serviceKey: 'plumbing',
      title: 'Fuga', amount: 80, currency: 'EUR', status: 'scheduled',
    });
    const body = { toUserId: PRO, roleContext: 'pro', relatedId: String(offer._id), score: 5 };
    await review(LANDLORD, 'landlord', body).expect(403);

    await ServiceOffer.updateOne({ _id: offer._id }, { status: 'done' });
    await review(STRANGER, 'landlord', body).expect(403);
    await review(LANDLORD, 'landlord', body).expect(201);

    const ticket = await Ticket.create({
      contractId: 'x', openedBy: TENANT, ownerId: LANDLORD, proId: PRO,
      service: 'plumbing', title: 'Grifo', description: 'Gotea', status: 'closed',
    });
    await review(TENANT, 'tenant', {
      toUserId: PRO, roleContext: 'pro', relatedId: String(ticket._id), score: 3,
    }).expect(201);
  });
});
