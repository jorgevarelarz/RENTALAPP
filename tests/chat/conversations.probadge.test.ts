import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startMongoMemoryServer } from '../../src/__tests__/utils/mongoMemoryServer';
import { User } from '../../src/models/user.model';
import { Contract } from '../../src/models/contract.model';

let app: any;
let mongo: MongoMemoryServer | undefined;

describe('Conversations payload includes PRO flags', () => {
  const landlordId = new mongoose.Types.ObjectId().toString();
  const tenantId = new mongoose.Types.ObjectId().toString();
  let contractId = '';

  beforeAll(async () => {
    mongo = await startMongoMemoryServer();
    process.env.MONGO_URL = mongo.getUri();
    process.env.NODE_ENV = 'test';
    const mod = await import('../../src/app');
    app = mod.app || mod.default;
    // Create users (tenant with PRO)
    await User.create({ _id: tenantId, name: 'Ten', email: 't@test.com', passwordHash: 'x', role: 'tenant', tenantPro: { status: 'verified', maxRent: 1500 } } as any);
    await User.create({ _id: landlordId, name: 'Lan', email: 'l@test.com', passwordHash: 'x', role: 'landlord' } as any);
    // Minimal contract
    const c = await Contract.create({
      landlord: landlordId,
      tenant: tenantId,
      property: new mongoose.Types.ObjectId().toString(),
      rent: 800,
      deposit: 800,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      region: 'galicia',
      status: 'draft',
      clauses: [],
    } as any);
    contractId = c.id;
    // Ensure conversation as landlord
    const ensure = await request(app)
      .post('/api/chat/conversations/ensure')
      .set('x-user-id', landlordId)
      .send({ kind: 'contract', refId: contractId });
    expect(ensure.status).toBe(200);
  });

  afterAll(async () => {
    await mongoose.connection.close();
    if (mongo) await mongo.stop();
  });

  it('lists conversations with participantsInfo including isPro/proLimit', async () => {
    const res = await request(app)
      .get('/api/chat/conversations')
      .set('x-user-id', landlordId);
    expect(res.status).toBe(200);
    const conv = res.body?.[0];
    expect(conv).toBeTruthy();
    expect(Array.isArray(conv.participantsInfo)).toBe(true);
    const tp = conv.participantsInfo.find((p: any) => p.id === tenantId);
    expect(tp?.isPro).toBe(true);
    expect(tp?.proLimit).toBe(1500);
  });
});
