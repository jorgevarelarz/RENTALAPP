import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';

const signToken = (payload: any) => jwt.sign(payload, JWT_SECRET);

const defaultPayload = {
  landlord: '507f1f77bcf86cd799439011',
  tenant: '507f1f77bcf86cd799439012',
  property: '507f1f77bcf86cd799439013',
  region: 'galicia',
  rent: 750,
  deposit: 750,
  startDate: '2025-10-01',
  endDate: '2026-09-30',
  clauses: [{ id: 'duracion_prorroga', params: { mesesIniciales: 12, mesesProrroga: 12 } }],
};

const createVersion = async (policyType: string, version: string) => {
  const token = signToken({ _id: '000000000000000000000999', role: 'admin' });
  await request(app)
    .post('/api/policies/version')
    .set('Authorization', `Bearer ${token}`)
    .send({ policyType, version })
    .expect(201);
};

const acceptPolicy = async (token: string, policyType: string, policyVersion: string) => {
  await request(app)
    .post('/api/policies/accept')
    .set('Authorization', `Bearer ${token}`)
    .send({ policyType, policyVersion })
    .expect(201);
};

describe('Contracts require policy acceptance', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('returns 409 until required policies are accepted', async () => {
    const userToken = signToken({ _id: '507f1f77bcf86cd799439011', role: 'landlord' });

    await createVersion('terms_of_service', 'v2.0');
    await createVersion('data_processing', 'v3.0');

    // Missing both
    const res1 = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${userToken}`)
      .send(defaultPayload)
      .expect(409);
    expect(res1.body.missingPolicies).toEqual(expect.arrayContaining(['terms_of_service', 'data_processing']));

    // Accept only terms_of_service
    await acceptPolicy(userToken, 'terms_of_service', 'v2.0');

    const res2 = await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${userToken}`)
      .send(defaultPayload)
      .expect(409);
    expect(res2.body.missingPolicies).toEqual(expect.arrayContaining(['data_processing']));

    // Accept data_processing too
    await acceptPolicy(userToken, 'data_processing', 'v3.0');

    await request(app)
      .post('/api/contracts')
      .set('Authorization', `Bearer ${userToken}`)
      .send(defaultPayload)
      .expect(201);
  });
});
