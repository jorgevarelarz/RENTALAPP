import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
import Ticket from '../../src/models/ticket.model';

let app: any;
let mongo: MongoMemoryServer | undefined;

describe('Chat attachments whitelist', () => {
  const proId = new mongoose.Types.ObjectId().toString();
  const ownerId = new mongoose.Types.ObjectId().toString();
  const tenantId = new mongoose.Types.ObjectId().toString();
  let conversationId = '';
  let ticketId = '';

  beforeAll(async () => {
    mongo = await startMongoMemoryServer();
    process.env.MONGO_URL = mongo.getUri();
    process.env.NODE_ENV = 'test';
    process.env.UPLOADS_BASE_URL = 'https://cdn.example.com/uploads';
    const mod = await import('../../src/app');
    app = mod.app || mod.default;
    const t = await Ticket.create({
      contractId: new mongoose.Types.ObjectId().toString(),
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
    // Ensure conversation as pro (participant)
    const ensure = await request(app)
      .post('/api/chat/conversations/ensure')
      .set('x-user-id', proId)
      .send({ kind: 'ticket', refId: ticketId });
    expect(ensure.status).toBe(200);
    conversationId = ensure.body._id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
    if (mongo) await mongo.stop();
  });

  it('rejects disallowed attachment domains', async () => {
    const res = await request(app)
      .post(`/api/chat/${conversationId}/messages`)
      .set('x-user-id', proId)
      .send({ body: 'hola', attachmentUrl: 'https://evil.example.com/file.jpg' });
    expect(res.status).toBe(400);
    expect(res.body?.error).toBe('attachment_domain_not_allowed');
  });

  it('accepts allowed attachment domains', async () => {
    const res = await request(app)
      .post(`/api/chat/${conversationId}/messages`)
      .set('x-user-id', proId)
      .send({ body: 'ok', attachmentUrl: 'https://cdn.example.com/uploads/a.jpg' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ type: 'user', body: 'ok' });
  });
});

