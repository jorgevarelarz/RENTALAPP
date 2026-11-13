import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';
import { Payment } from '../../src/models/payment.model';

// Resumen del panel del propietario: un pago confirmado sin paidAt
// no debe llegar con fecha vacía (el panel mostraba «Invalid Date»).
describe('GET /api/users/me/stats', () => {
  const landlordId = '507f1f77bcf86cd799439c01';
  const tenantId = '507f1f77bcf86cd799439c02';

  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('suma los ingresos y da fecha a todos los pagos recientes', async () => {
    const contract = await Contract.create({
      landlord: landlordId,
      tenant: tenantId,
      property: '507f1f77bcf86cd799439c03',
      rent: 900,
      deposit: 900,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      region: 'general',
      clauses: [],
    });
    const base = { contract: contract._id, payer: tenantId, payee: landlordId, status: 'succeeded', type: 'service' };
    await Payment.create({ ...base, amount: 900, concept: 'Renta', paidAt: new Date('2026-10-01T10:00:00Z') });
    await Payment.create({ ...base, amount: 40, concept: 'Recibo sin paidAt' });

    const res = await request(app)
      .get('/api/users/me/stats')
      .set('x-user-id', landlordId)
      .set('x-user-role', 'landlord')
      .set('x-user-verified', 'true')
      .expect(200);

    expect(res.body.earnings).toBe(940);
    expect(res.body.recentPayments).toHaveLength(2);
    for (const payment of res.body.recentPayments) {
      expect(Number.isNaN(new Date(payment.date).getTime())).toBe(false);
    }
  });
});
