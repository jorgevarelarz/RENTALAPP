import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import { Contract } from '../../src/models/contract.model';
import { stripe as paymentStripe } from '../../src/utils/payment';
import { logger } from '../../src/utils/logger';

// Los 500 de contratos y pagos no devuelven el mensaje interno (Mongo, Stripe);
// los errores deliberados conservan su texto con el estado que les toca.
describe('Errores de contratos y pagos', () => {
  const tenantId = '507f1f77bcf86cd799439b01';
  const landlordId = '507f1f77bcf86cd799439b02';
  const otherTenantId = '507f1f77bcf86cd799439b03';
  const as = (id: string, role: string) => ({ 'x-user-id': id, 'x-user-role': role, 'x-user-verified': 'true' });
  const secret = 'E11000 duplicate key error dup key: { email: "ana@example.com" }';
  let contractId: string;

  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(async () => {
    jest.restoreAllMocks();
    await clearDb();
  });

  beforeEach(async () => {
    jest.spyOn(logger, 'error').mockImplementation(() => undefined as any);
    await User.create([
      { _id: tenantId, name: 'Inquilina', email: 'inq-b01@test.com', role: 'tenant' },
      { _id: landlordId, name: 'Casero', email: 'cas-b02@test.com', role: 'landlord' },
      { _id: otherTenantId, name: 'Otra', email: 'otra-b03@test.com', role: 'tenant' },
    ]);
    const contract = await Contract.create({
      landlord: new mongoose.Types.ObjectId(landlordId),
      tenant: new mongoose.Types.ObjectId(tenantId),
      property: new mongoose.Types.ObjectId(),
      rent: 800,
      deposit: 1600,
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      region: 'madrid',
      status: 'draft',
      stripeCustomerId: 'cus_err_1',
    });
    contractId = String(contract._id);
  });

  it('un fallo de Stripe al iniciar el pago da 500 con código fijo', async () => {
    jest.spyOn(paymentStripe.paymentIntents, 'create').mockRejectedValue(new Error(`Stripe: ${secret}`));
    const res = await request(app).post(`/api/contracts/${contractId}/pay`).set(as(tenantId, 'tenant')).send().expect(500);
    expect(res.body).toEqual({ error: 'payment_init_failed', code: 500 });
  });

  it('iniciar el pago: contrato inexistente o mal formado da 404 y otro inquilino 403', async () => {
    const missing = new mongoose.Types.ObjectId();
    await request(app).post(`/api/contracts/${missing}/pay`).set(as(tenantId, 'tenant')).send().expect(404);
    await request(app).post('/api/contracts/xyz/pay').set(as(tenantId, 'tenant')).send().expect(404);
    const res = await request(app).post(`/api/contracts/${contractId}/pay`).set(as(otherTenantId, 'tenant')).send().expect(403);
    expect(res.body.error).toBe('Solo el inquilino puede iniciar pagos');
  });

  it('firmar dos veces da 409 con su mensaje; un id mal formado, 404', async () => {
    await request(app).patch(`/api/contracts/${contractId}/sign`).set(as(landlordId, 'landlord')).send().expect(200);
    const again = await request(app).patch(`/api/contracts/${contractId}/sign`).set(as(landlordId, 'landlord')).send().expect(409);
    expect(again.body.error).toBe('El arrendador ya ha firmado este contrato');
    await request(app).patch('/api/contracts/xyz/sign').set(as(landlordId, 'landlord')).send().expect(404);
  });

  it('un fallo de Mongo al firmar da 500 sin el mensaje', async () => {
    jest.spyOn(Contract, 'findById').mockRejectedValueOnce(new Error(secret));
    const res = await request(app).patch(`/api/contracts/${contractId}/sign`).set(as(landlordId, 'landlord')).send().expect(500);
    expect(res.body).toEqual({ error: 'contract_sign_failed', code: 500 });
  });

  it('listado, ficha y recordatorio no devuelven el error interno', async () => {
    jest.spyOn(Contract, 'find').mockImplementation(() => {
      throw new Error(secret);
    });
    const list = await request(app).get('/api/contracts').set(as(landlordId, 'landlord')).expect(500);
    expect(list.body).toEqual({ error: 'contracts_list_failed', code: 500 });

    jest.spyOn(User, 'findById').mockImplementation(() => {
      throw new Error(secret);
    });
    const remind = await request(app).post(`/api/contracts/${contractId}/remind`).set(as(landlordId, 'landlord')).send().expect(500);
    expect(remind.body).toEqual({ error: 'rent_reminder_failed', code: 500 });
    expect(JSON.stringify(remind.body)).not.toContain('ana@example.com');
  });

  it('terminar conserva el 409 de la transición y oculta el 500', async () => {
    await request(app).post(`/api/contracts/${contractId}/terminate`).set(as(landlordId, 'landlord')).send().expect(200);
    const res = await request(app).post(`/api/contracts/${contractId}/terminate`).set(as(landlordId, 'landlord')).send().expect(409);
    expect(res.body).toMatchObject({ error: 'invalid_transition', from: 'terminated', to: 'terminated' });

    jest.spyOn(Contract, 'findById').mockImplementation(() => {
      throw new Error(secret);
    });
    const fail = await request(app).post(`/api/contracts/${contractId}/terminate`).set(as(landlordId, 'landlord')).send().expect(500);
    expect(fail.body).toEqual({ error: 'termination_failed', code: 500 });
  });
});
