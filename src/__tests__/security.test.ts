import request from 'supertest';
import mongoose from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { startMongoMemoryServer } from './utils/mongoMemoryServer';
import { User } from '../models/user.model';
import { Contract } from '../models/contract.model';

let app: any;
let mongo: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongo = await startMongoMemoryServer();
  process.env.MONGO_URL = mongo.getUri();
  process.env.NODE_ENV = 'test';
  process.env.ALLOW_UNVERIFIED = 'true';
  const mod = await import('../app');
  app = mod.app || mod.default;
});

afterAll(async () => {
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
});

describe('Security: Contract Access (IDOR)', () => {
  let tokenUserA = '';
  let tokenUserB = '';
  let contractId = '';

  it('should create two users and a contract for user A', async () => {
    // Create User A (landlord)
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User A', email: 'usera@example.com', password: 'password', role: 'landlord' });
    tokenUserA = resA.body.token;
    const userA = await User.findOne({ email: 'usera@example.com' });

    // Create User B (tenant)
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User B', email: 'userb@example.com', password: 'password', role: 'tenant' });
    tokenUserB = resB.body.token;

    // User A creates a property
    const propRes = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${tokenUserA}`)
      .send({
        owner: String(userA?._id),
        title: 'Prop A',
        description: 'Nice flat',
        address: 'Addr A',
        region: 'madrid',
        city: 'Madrid',
        location: { lng: -3.70379, lat: 40.41678 },
        price: 100,
        deposit: 100,
        sizeM2: 60,
        rooms: 2,
        bathrooms: 1,
        furnished: false,
        petsAllowed: false,
        availableFrom: new Date().toISOString(),
        images: ['https://cdn/a1.jpg', 'https://cdn/a2.jpg', 'https://cdn/a3.jpg'],
      });
    const propertyId = propRes.body._id;

    // Create a contract for User A's property (with a dummy tenant for now)
    const contract = new Contract({
      landlord: userA?._id,
      tenant: new mongoose.Types.ObjectId(),
      property: propertyId,
      rent: 100,
      deposit: 500, // <-- FIX: Added required deposit field
      startDate: new Date(),
      endDate: new Date(),
    });
    await contract.save();
    contractId = contract._id;
  });

  it('User B should NOT be able to access User A\'s contract via getContract', async () => {
    const res = await request(app)
      .get(`/api/contracts/${contractId}`)
      .set('Authorization', `Bearer ${tokenUserB}`);
    
    expect(res.status).toBe(404);
  });

  it('User B should NOT see User A\'s contract in listContracts', async () => {
    const res = await request(app)
      .get('/api/contracts')
      .set('Authorization', `Bearer ${tokenUserB}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.items.length).toBe(0);
  });

  it('User A should be able to access their own contract', async () => {
    const res = await request(app)
      .get(`/api/contracts/${contractId}`)
      .set('Authorization', `Bearer ${tokenUserA}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(String(contractId));
  });
});
