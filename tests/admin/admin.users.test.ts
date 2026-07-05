import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';
const adminToken = jwt.sign({ id: '507f1f77bcf86cd799439000', role: 'admin' }, JWT_SECRET);

describe('Admin users API', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('creates an agency user and returns email in the users list', async () => {
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Inmo Norte',
        email: 'agency-admin@test.com',
        password: 'temporal123',
        role: 'agency',
        companyName: 'Inmo Norte SL',
      })
      .expect(201);

    expect(created.body.user.email).toBe('agency-admin@test.com');
    expect(created.body.user.role).toBe('agency');
    expect(created.body.user.isVerified).toBe(true);

    const list = await request(app)
      .get('/api/users?role=agency')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].email).toBe('agency-admin@test.com');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'agency-admin@test.com', password: 'temporal123' })
      .expect(200);

    await request(app)
      .get('/api/agency/earnings/summary')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
  });

  it('rejects duplicate agency email', async () => {
    await User.create({
      name: 'Existing',
      email: 'agency-admin@test.com',
      passwordHash: 'hash',
      role: 'agency',
      isVerified: true,
    });

    await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Inmo Norte',
        email: 'agency-admin@test.com',
        password: 'temporal123',
        role: 'agency',
      })
      .expect(409);
  });
});
