import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';
const signToken = (payload: any) => jwt.sign(payload, JWT_SECRET);

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

describe('Escrow flows require policy acceptance', () => {
  beforeAll(async () => {
    process.env.ESCROW_DRIVER = 'mock';
    await connectDb();
  });
  afterAll(disconnectDb);
  afterEach(clearDb);

  const bootstrapTicket = async () => {
    const tenantToken = signToken({ _id: '507f1f77bcf86cd799439010', role: 'tenant' });
    const proToken = signToken({ _id: '507f1f77bcf86cd799439020', role: 'pro' });

    const ticket = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        contractId: '507f1f77bcf86cd799439099',
        ownerId: '507f1f77bcf86cd799439011',
        propertyId: '507f1f77bcf86cd799439012',
        service: 'maintenance',
        title: 'Fix sink',
        description: 'Leak in kitchen',
      })
      .expect(201);

    // Pro sends quote
    await request(app)
      .post(`/api/tickets/${ticket.body._id}/quote`)
      .set('Authorization', `Bearer ${proToken}`)
      .send({ amount: 100 })
      .expect(200);

    return { ticketId: ticket.body._id, tenantToken, proToken };
  };

  it('blocks escrow approve/release until policies are accepted', async () => {
    await createVersion('terms_of_service', 'v1.0');
    await createVersion('data_processing', 'v1.0');

    const landlordToken = signToken({ _id: '507f1f77bcf86cd799439011', role: 'landlord' });
    const { ticketId, tenantToken } = await bootstrapTicket();

    // Landlord without policies -> 409
    const missingBoth = await request(app)
      .post(`/api/tickets/${ticketId}/approve`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ customerId: 'cus_test' });
    expect(missingBoth.status).toBe(409);
    expect(missingBoth.body.missingPolicies).toEqual(
      expect.arrayContaining(['terms_of_service', 'data_processing'])
    );

    // Accept only terms_of_service -> still missing data_processing
    await acceptPolicy(landlordToken, 'terms_of_service', 'v1.0');
    const missingData = await request(app)
      .post(`/api/tickets/${ticketId}/approve`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ customerId: 'cus_test' });
    expect(missingData.status).toBe(409);
    expect(missingData.body.missingPolicies).toEqual(expect.arrayContaining(['data_processing']));

    // Accept both -> approve succeeds
    await acceptPolicy(landlordToken, 'data_processing', 'v1.0');
    const approve = await request(app)
      .post(`/api/tickets/${ticketId}/approve`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ customerId: 'cus_test' })
      .expect(200);

    expect(approve.body?.escrow?.status).toBe('held');
    const escrowId = approve.body?.escrow?._id;

    // Tenant cannot resolve without policies
    const missingTenant = await request(app)
      .post(`/api/tickets/${ticketId}/resolve`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .expect(409);
    expect(missingTenant.body.missingPolicies).toEqual(
      expect.arrayContaining(['terms_of_service', 'data_processing'])
    );

    await acceptPolicy(tenantToken, 'terms_of_service', 'v1.0');
    await acceptPolicy(tenantToken, 'data_processing', 'v1.0');

    const resolve = await request(app)
      .post(`/api/tickets/${ticketId}/resolve`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .expect(200);

    expect(resolve.body?.escrow?.status).toBe('released');
    expect(resolve.body?.escrow?._id).toBe(escrowId);
  });
});
