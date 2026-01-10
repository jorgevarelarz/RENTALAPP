import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
import Ticket from '../../src/models/ticket.model';

let app: any;
let mongo: MongoMemoryServer | undefined;

describe('Appointments API', () => {
  const proId = new mongoose.Types.ObjectId().toString();
  const ownerId = new mongoose.Types.ObjectId().toString();
  const tenantId = new mongoose.Types.ObjectId().toString();
  let ticketId: string = '';

  beforeAll(async () => {
    mongo = await startMongoMemoryServer();
    process.env.MONGO_URL = mongo.getUri();
    process.env.NODE_ENV = 'test';
    await mongoose.connect(mongo.getUri());
    const mod = await import('../../src/app');
    app = mod.app || mod.default;
    const t = await Ticket.create({
      contractId: new mongoose.Types.ObjectId().toString(),
      propertyId: new mongoose.Types.ObjectId().toString(),
      openedBy: tenantId,
      ownerId,
      proId,
      service: 'plumbing',
      title: 'Goteo',
      description: 'Se ha roto un latiguillo',
      status: 'awaiting_schedule',
      history: [],
    } as any);
    ticketId = t.id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
    if (mongo) await mongo.stop();
  });

  it('rejects missing fields with 400', async () => {
    const res = await request(app)
      .post(`/api/appointments/${ticketId}/propose`)
      .set('x-user-id', proId)
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects invalid dates', async () => {
    const res = await request(app)
      .post(`/api/appointments/${ticketId}/propose`)
      .set('x-user-id', proId)
      .send({ start: 'bad', end: 'worse', timezone: 'Europe/Madrid' });
    expect(res.status).toBe(400);
  });

  it('accepts a valid proposal', async () => {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const res = await request(app)
      .post(`/api/appointments/${ticketId}/propose`)
      .set('x-user-id', proId)
      .send({ start, end, timezone: 'Europe/Madrid' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'proposed', ticketId });
  });
});
