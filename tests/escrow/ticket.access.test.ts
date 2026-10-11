import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { bearer } from '../utils/sessionToken';
import { Contract } from '../../src/models/contract.model';
import Ticket from '../../src/models/ticket.model';
import Escrow from '../../src/models/escrow.model';
import { Property } from '../../src/models/property.model';
import * as email from '../../src/utils/email';

const JWT_SECRET = process.env.JWT_SECRET || 'insecure';
const token = bearer;

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
      .set('Authorization', await token(TENANT, 'tenant'))
      .send({ contractId: String(contract._id), ownerId: OTHER_LANDLORD, service: 'plumbing', title: 'Grifo', description: 'Gotea' })
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
      .set('Authorization', await token(OTHER_TENANT, 'tenant'))
      .send({ contractId: String(contract._id), service: 'plumbing', title: 'x', description: 'x' })
      .expect(403);
  });

  it('only lets the involved parties act on and read the ticket', async () => {
    const { ticketId } = await openTicket();
    // Sin seleccionar, ningún profesional puede presupuestar ni ver el ticket
    await request(app).post(`/api/tickets/${ticketId}/quote`).set('Authorization', await token(PRO, 'pro')).send({ amount: 100 }).expect(403);
    await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', await token(PRO, 'pro')).expect(403);
    await selectPro(ticketId);
    await request(app).post(`/api/tickets/${ticketId}/quote`).set('Authorization', await token(PRO, 'pro')).send({ amount: 100 }).expect(200);
    await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', await token(PRO, 'pro')).expect(200);

    // Otro pro no puede re-presupuestar ni completar un ticket ya asignado
    await request(app).post(`/api/tickets/${ticketId}/quote`).set('Authorization', await token(OTHER_PRO, 'pro')).send({ amount: 1 }).expect(403);
    await request(app).post(`/api/tickets/${ticketId}/complete`).set('Authorization', await token(OTHER_PRO, 'pro')).send({}).expect(403);
    // Otro propietario no puede aprobar, asignar ni leer
    await request(app).post(`/api/tickets/${ticketId}/approve`).set('Authorization', await token(OTHER_LANDLORD, 'landlord')).send({ customerId: 'cus_x' }).expect(403);
    await request(app).post(`/api/tickets/${ticketId}/unassign`).set('Authorization', await token(OTHER_LANDLORD, 'landlord')).expect(403);
    await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', await token(OTHER_LANDLORD, 'landlord')).expect(403);
    await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', await token(TENANT, 'tenant')).expect(200);
  });

  it('releases the escrow only once, only by its owner, and only after the work is completed', async () => {
    const { ticketId } = await openTicket();
    const L = await token(LANDLORD, 'landlord');
    await selectPro(ticketId);
    await request(app).post(`/api/tickets/${ticketId}/quote`).set('Authorization', await token(PRO, 'pro')).send({ amount: 100 }).expect(200);
    await request(app).post(`/api/tickets/${ticketId}/approve`).set('Authorization', L).send({ customerId: 'cus_mock' }).expect(200);

    await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', L).expect(409); // trabajo sin completar
    await request(app).post(`/api/tickets/${ticketId}/complete`).set('Authorization', await token(PRO, 'pro')).send({}).expect(200);
    await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', await token(TENANT, 'tenant')).expect(403);
    await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', await token(OTHER_LANDLORD, 'landlord')).expect(403);

    await request(app).post(`/api/tickets/${ticketId}/validate`).set('Authorization', L).expect(200);
    const again = await request(app).post(`/api/tickets/${ticketId}/resolve`).set('Authorization', await token(TENANT, 'tenant'));
    expect(again.status).toBe(409);
    const t = await Ticket.findById(ticketId).lean();
    expect((await Escrow.findById(t?.escrowId).lean())?.status).toBe('released');
  });

  it('follows the real flow: pay, appointment, complete, confirm; and blocks steps out of order', async () => {
    const { ticketId } = await openTicket();
    const L = await token(LANDLORD, 'landlord');
    const P = await token(PRO, 'pro');
    const T = await token(TENANT, 'tenant');
    await selectPro(ticketId);
    await request(app).post(`/api/tickets/${ticketId}/quote`).set('Authorization', P).send({ amount: 100 }).expect(200);

    // Antes de pagar: ni cita ni trabajo completado
    await request(app).post(`/api/appointments/${ticketId}/propose`).set('Authorization', P)
      .send({ start: '2030-01-10T09:00:00Z', end: '2030-01-10T10:00:00Z', timezone: 'Europe/Madrid' }).expect(409);
    await request(app).post(`/api/tickets/${ticketId}/complete`).set('Authorization', P).send({}).expect(409);

    await request(app).post(`/api/tickets/${ticketId}/approve`).set('Authorization', L).send({ customerId: 'cus_mock' }).expect(200);
    // El inquilino no puede liberar el pago antes de que el profesional termine
    await request(app).post(`/api/tickets/${ticketId}/resolve`).set('Authorization', T).expect(409);

    await request(app).post(`/api/appointments/${ticketId}/propose`).set('Authorization', P)
      .send({ start: '2030-01-10T09:00:00Z', end: '2030-01-10T10:00:00Z', timezone: 'Europe/Madrid' }).expect(200);
    const seen = await request(app).get(`/api/tickets/${ticketId}`).set('Authorization', T).expect(200);
    expect(seen.body.appointment).toMatchObject({ status: 'proposed', start: '2030-01-10T09:00:00.000Z' });
    expect(seen.body.pro).toMatchObject({ id: PRO });

    await request(app).post(`/api/appointments/${ticketId}/accept`).set('Authorization', T).expect(200);
    await request(app).post(`/api/appointments/${ticketId}/accept`).set('Authorization', T).expect(409);
    expect((await Ticket.findById(ticketId).lean())?.status).toBe('scheduled');

    await request(app).post(`/api/tickets/${ticketId}/complete`).set('Authorization', P).send({}).expect(200);
    await request(app).post(`/api/tickets/${ticketId}/complete`).set('Authorization', P).send({}).expect(409);
    await request(app).post(`/api/tickets/${ticketId}/resolve`).set('Authorization', T).expect(200);
    expect((await Ticket.findById(ticketId).lean())?.status).toBe('closed');
  });

  it('validates the report, needs an active contract and emails the owner', async () => {
    const send = jest.spyOn(email, 'sendTicketOpenedEmail').mockResolvedValue('sent');
    try {
      await token(LANDLORD, 'landlord'); // crea la cuenta del propietario (correo sesion-<id>@test.com)
      const T = await token(TENANT, 'tenant');
      const property = await Property.create({
        owner: LANDLORD, title: 'Piso en Chamberí', address: 'Calle Real 1', city: 'Madrid', region: 'madrid',
        location: { type: 'Point', coordinates: [-3.7, 40.43] }, price: 900, deposit: 900, availableFrom: new Date(),
      });
      const contract = await Contract.create({
        landlord: LANDLORD, tenant: TENANT, property: property._id,
        rent: 700, deposit: 700, startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000),
        region: 'general', clauses: [], status: 'active',
      });
      const base = { contractId: String(contract._id), service: 'plumbing', title: 'Gotera', description: 'Cae agua del techo' };
      const post = (body: object) => request(app).post('/api/tickets').set('Authorization', T).send(body);

      expect((await post({ ...base, service: 'maintenance' }).expect(400)).body.error).toBe('invalid_service');
      expect((await post({ ...base, title: '   ' }).expect(400)).body.error).toBe('invalid_title');
      expect((await post({ ...base, title: 'x'.repeat(121) }).expect(400)).body.error).toBe('invalid_title');
      expect((await post({ ...base, description: '' }).expect(400)).body.error).toBe('invalid_description');
      expect(send).not.toHaveBeenCalled();

      const created = await post({ ...base, title: '  Gotera  ' }).expect(201);
      expect(created.body.title).toBe('Gotera');
      // El correo sale después de responder
      for (let i = 0; i < 100 && !send.mock.calls.length; i++) await new Promise(resolve => setTimeout(resolve, 20));
      expect(send).toHaveBeenCalledTimes(1);
      const [to, info] = send.mock.calls[0];
      expect(to).toBe(`sesion-${LANDLORD}@test.com`);
      expect(info).toMatchObject({ ticketId: created.body._id, title: 'Gotera', serviceLabel: 'Fontanería' });
      expect(info).toMatchObject({ propertyTitle: 'Piso en Chamberí', propertyAddress: 'Calle Real 1, Madrid' });

      await Contract.updateOne({ _id: contract._id }, { $set: { status: 'terminated' } });
      expect((await post(base).expect(409)).body.error).toBe('contract_not_active');
    } finally {
      send.mockRestore();
    }
  });

  it('accepts only own uploaded photos on a report and returns them in the ticket', async () => {
    const send = jest.spyOn(email, 'sendTicketOpenedEmail').mockResolvedValue('sent');
    try {
      // La cuenta del propietario tiene que existir antes de abrir la incidencia: el aviso busca su correo.
      const L = await token(LANDLORD, 'landlord');
      const T = await token(TENANT, 'tenant');
      const contract = await Contract.create({
        landlord: LANDLORD, tenant: TENANT, property: '507f1f77bcf86cd799439012',
        rent: 700, deposit: 700, startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000),
        region: 'general', clauses: [], status: 'active',
      });
      const base = { contractId: String(contract._id), service: 'plumbing', title: 'Gotera', description: 'Cae agua del techo' };
      const post = (body: object) => request(app).post('/api/tickets').set('Authorization', T).send(body);
      const own = (n: number) => `/uploads/${'a'.repeat(31)}${n}.jpg`;

      for (const photos of [
        'not-an-array',
        ['https://evil.example.com/uploads/x.jpg'],
        ['/uploads/../.env'],
        [42],
        [1, 2, 3, 4, 5, 6, 7].map(own),
      ]) {
        expect((await post({ ...base, photos }).expect(400)).body.error).toBe('invalid_photos');
      }

      const created = await post({ ...base, photos: [own(1), own(2), own(1)] }).expect(201);
      expect(created.body.photos).toEqual([own(1), own(2)]); // sin duplicados
      const read = await request(app).get(`/api/tickets/${created.body._id}`).set('Authorization', L).expect(200);
      expect(read.body.photos).toEqual([own(1), own(2)]);
      for (let i = 0; i < 100 && !send.mock.calls.length; i++) await new Promise(resolve => setTimeout(resolve, 20));
      expect(send.mock.calls[0][1]).toMatchObject({ photoCount: 2 });

      const plain = await post(base).expect(201);
      expect(plain.body.photos).toBeUndefined();
    } finally {
      send.mockRestore();
    }
  });

  it('escapes the report in the owner email', () => {
    const { subject, html } = email.ticketOpenedEmail({
      ticketId: 'abc', title: '<b>Gotera</b>', serviceLabel: 'Fontanería', description: '<script>x</script>',
      tenantName: 'Ana <img>', propertyTitle: 'Piso', propertyAddress: 'Calle Real 1, Madrid',
    });
    expect(subject).toBe('Nueva avería: <b>Gotera</b>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;b&gt;Gotera&lt;/b&gt;');
    expect(html).toContain('/tickets/abc');
    expect(html).not.toContain('foto');
    expect(email.ticketOpenedEmail({ ticketId: 'abc', title: 'G', serviceLabel: 'F', description: 'd', photoCount: 3 }).html)
      .toContain('Ha adjuntado 3 fotos');
  });
});
