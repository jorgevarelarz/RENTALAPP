import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';
import Ticket from '../../src/models/ticket.model';
import Escrow from '../../src/models/escrow.model';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';
const token = (_id: string, role: string) => `Bearer ${jwt.sign({ _id, role }, JWT_SECRET)}`;

const LANDLORD = '507f1f77bcf86cd799439011';
const OTHER_LANDLORD = '507f1f77bcf86cd799439031';
const TENANT = '507f1f77bcf86cd799439010';
const OTHER_TENANT = '507f1f77bcf86cd799439030';
const PRO = '507f1f77bcf86cd799439020';
const OTHER_PRO = '507f1f77bcf86cd799439040';

describe('Ticket access control', () => {
  const originalBypass = process.env.ALLOW_POLICY_BYPASS;
  beforeAll(async () => {
    process.env.ESCROW_DRIVER = 'mock';
    process.env.ALLOW_POLICY_BYPASS = 'true';
    await connectDb();
  });
  afterAll(async () => {
    // Jest --runInBand comparte process.env entre ficheros
    if (originalBypass === undefined) delete process.env.ALLOW_POLICY_BYPASS;
    else process.env.ALLOW_POLICY_BYPASS = originalBypass;
    await disconnectDb();
  });
  afterEach(clearDb);

  const openTicket = async () => {
    const contract = await Contract.create({
      landlord: LANDLORD, tenant: TENANT, property: '507f1f77bcf86cd799439012',
      rent: 700, deposit: 700, startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000),
      region: 'general', clauses: [], status: 'active',
    });
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', token(TENANT, 'tenant'))
      .send({ contractId: String(contract._id), ownerId: OTHER_LANDLORD, service: 'maintenance', title: 'Grifo', description: 'Gotea' })
      .expect(201);
    return { contract, ticketId: res.body._id as string, ticket: res.body };
  };
  // Equivale a que el propietario seleccione al profesional con /assign
  const selectPro = (ticketId: string, proUserId = PRO) => Ticket.updateOne({ _id: ticketId }, { $set: { proId: proUserId } });

  it('takes owner and property from the contract and rejects contracts of other tenants', async () => {
    const { contract, ticket } = await openTicket();
    expect(ticket.ownerId).toBe(LANDLORD); // ownerId del body ignorado
    await request(app)
      .post('/api/tickets')
      .set('Authorization', token(OTHER_TENANT, 'tenant'))
      .send({ contractId: String(contract._id), service: 'x', title: 'x', description: 'x' })
      .expect(403);
  });

  it('only lets the involved parties act on and read the ticket', async () => {
    const { ticketId } = await openTicket();
    // Sin seleccionar, ningún profesional puede presupuestar ni ver el ticket
    await request(app).post(`/api/tickets/${ticketId}/quote`).set('Authorization', token(PRO, 'pro')).send({ amount: 100 }).expect(403);
    await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', token(PRO, 'pro')).expect(403);
    await selectPro(ticketId);
    await request(app).post(`/api/tickets/${ticketId}/quote`).set('Authorization', token(PRO, 'pro')).send({ amount: 100 }).expect(200);
    await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', token(PRO, 'pro')).expect(200);

    // Otro pro no puede re-presupuestar ni completar un ticket ya asignado
    await request(app).post(`/api/tickets/${ticketId}/quote`).set('Authorization', token(OTHER_PRO, 'pro')).send({ amount: 1 }).expect(403);
    await request(app).post(`/api/tickets/${ticketId}/complete`).set('Authorization', token(OTHER_PRO, 'pro')).send({}).expect(403);
    // Otro propietario no puede aprobar, asignar ni leer
    await request(app).post(`/api/tickets/${ticketId}/approve`).set('Authorization', token(OTHER_LANDLORD, 'landlord')).send({ customerId: 'cus_x' }).expect(403);
    await request(app).post(`/api/tickets/${ticketId}/unassign`).set('Authorization', token(OTHER_LANDLORD, 'landlord')).expect(403);
    await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', token(OTHER_LANDLORD, 'landlord')).expect(403);
    await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', token(TENANT, 'tenant')).expect(200);
  });

  it('releases the escrow only once, only by its owner, and only after the work is completed', async () => {
    const { ticketId } = await openTicket();
    const L = token(LANDLORD, 'landlord');
    await selectPro(ticketId);
    await request(app).post(`/api/tickets/${ticketId}/quote`).set('Authorization', token(PRO, 'pro')).send({ amount: 100 }).expect(200);
    await request(app).post(`/api/tickets/${ticketId}/approve`).set('Authorization', L).send({ customerId: 'cus_mock' }).expect(200);

    await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', L).expect(409); // trabajo sin completar
    await request(app).post(`/api/tickets/${ticketId}/complete`).set('Authorization', token(PRO, 'pro')).send({}).expect(200);
    await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', token(TENANT, 'tenant')).expect(403);
    await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', token(OTHER_LANDLORD, 'landlord')).expect(403);

    await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', L).expect(200);
    const again = await request(app).post(`/api/tickets/${ticketId}/resolve`).set('Authorization', token(TENANT, 'tenant'));
    expect(again.status).toBe(409);
    const t = await Ticket.findById(ticketId).lean();
    expect((await Escrow.findById(t?.escrowId).lean())?.status).toBe('released');
  });
});
