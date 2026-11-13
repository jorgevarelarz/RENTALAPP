import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { bearer } from '../utils/sessionToken';
import { Contract } from '../../src/models/contract.model';
import { Property } from '../../src/models/property.model';
import { User } from '../../src/models/user.model';
import Pro from '../../src/models/pro.model';
import Ticket from '../../src/models/ticket.model';

const LANDLORD = '507f1f77bcf86cd799439011';
const TENANT = '507f1f77bcf86cd799439010';
const PRO = '507f1f77bcf86cd799439020';
const FAKE_PRO = '507f1f77bcf86cd799439021';

describe('Asignar profesional a una incidencia', () => {
  beforeAll(async () => {
    process.env.ESCROW_DRIVER = 'mock';
    await connectDb();
  });
  afterAll(disconnectDb);
  afterEach(clearDb);

  const openTicket = async () => {
    await bearer(LANDLORD, 'landlord');
    const property = await Property.create({
      title: 'Piso en Málaga', address: 'Calle Larios 1', region: 'andalucia', city: 'Málaga',
      location: { type: 'Point', coordinates: [-4.42, 36.72] }, price: 900, deposit: 900,
      availableFrom: new Date(), owner: LANDLORD,
    });
    const contract = await Contract.create({
      landlord: LANDLORD, tenant: TENANT, property: property._id,
      rent: 700, deposit: 700, startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000),
      region: 'general', clauses: [], status: 'active',
    });
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', await bearer(TENANT, 'tenant'))
      .send({ contractId: String(contract._id), service: 'plumbing', title: 'Grifo', description: 'Gotea' })
      .expect(201);
    return { ticketId: res.body._id as string };
  };

  it('asigna un perfil de profesional y la ficha trae su perfil público y la ciudad del inmueble', async () => {
    const { ticketId } = await openTicket();
    await bearer(PRO, 'pro');
    const pro = await Pro.create({ userId: PRO, displayName: 'Fontanería Sur', city: 'Málaga', services: [{ key: 'plumbing' }], active: true });
    const L = await bearer(LANDLORD, 'landlord');

    await request(app).post(`/api/tickets/${ticketId}/assign`).set('Authorization', L).send({ proId: String(pro._id) }).expect(200);
    const res = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', L).expect(200);
    expect(res.body.proId).toBe(PRO);
    expect(res.body.pro).toMatchObject({ id: PRO, displayName: 'Fontanería Sur', profileId: String(pro._id) });
    expect(res.body.propertyCity).toBe('Málaga');
  });

  it('no asigna perfiles de cuentas que no son de profesional, ids mal formados ni objetos', async () => {
    const { ticketId } = await openTicket();
    await bearer(FAKE_PRO, 'tenant');
    const fake = await Pro.create({ userId: FAKE_PRO, displayName: 'Inquilino', city: 'Málaga', services: [{ key: 'plumbing' }], active: true });
    const L = await bearer(LANDLORD, 'landlord');

    const notPro = await request(app).post(`/api/tickets/${ticketId}/assign`).set('Authorization', L).send({ proId: String(fake._id) });
    expect(notPro.status).toBe(404);
    expect(notPro.body.error).toBe('pro not found');
    await request(app).post(`/api/tickets/${ticketId}/assign`).set('Authorization', L).send({ proId: 'no-es-un-id' }).expect(404);
    const obj = await request(app).post(`/api/tickets/${ticketId}/assign`).set('Authorization', L).send({ proId: ['507f1f77bcf86cd799439099'] });
    expect(obj.status).toBe(400);
    expect(obj.body.error).toBe('invalid_pro');
    expect((await Ticket.findById(ticketId))?.proId).toBeFalsy();
  });

  it('una incidencia con id mal formado da 404 y no 500', async () => {
    const L = await bearer(LANDLORD, 'landlord');
    const res = await request(app).get('/api/tickets/xyz').set('Authorization', L);
    expect(res.status).toBe(404);
    await request(app).post('/api/tickets/xyz/assign').set('Authorization', L).send({ proId: '507f1f77bcf86cd799439099' }).expect(404);
  });

  it('el directorio busca la ciudad sin tildes ni mayúsculas y rechaza servicios desconocidos', async () => {
    await User.create({ _id: PRO, name: 'P', email: 'p@test.com', role: 'pro' } as any);
    await Pro.create({ userId: PRO, displayName: 'Fontanería Sur', city: 'Málaga', services: [{ key: 'plumbing' }], active: true });
    const L = await bearer(LANDLORD, 'landlord');

    const found = await request(app).get('/api/pros').query({ city: '  malaga ', service: 'plumbing' }).set('Authorization', L).expect(200);
    expect(found.body.items.map((p: any) => p.displayName)).toEqual(['Fontanería Sur']);
    const other = await request(app).get('/api/pros').query({ city: 'Mala.a' }).set('Authorization', L).expect(200);
    expect(other.body.total).toBe(0);
    await request(app).get('/api/pros').query({ service: 'gardening' }).set('Authorization', L).expect(400);
  });
});
