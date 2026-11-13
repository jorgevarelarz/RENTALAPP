import request from 'supertest';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';
import { Payment } from '../../src/models/payment.model';

// El concepto del pago llega al CSV del casero: no debe ejecutarse como fórmula.
describe('Exportación CSV de ingresos del casero', () => {
  const landlordId = '507f1f77bcf86cd799439b01';
  const tenantId = '507f1f77bcf86cd799439b02';

  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  it('neutraliza fórmulas en los campos de texto', async () => {
    const contract = await Contract.create({
      landlord: landlordId,
      tenant: tenantId,
      property: '507f1f77bcf86cd799439b03',
      rent: 900,
      deposit: 900,
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      region: 'general',
      clauses: [],
    });
    await Payment.create({
      contract: contract._id,
      payer: tenantId,
      payee: landlordId,
      amount: 900,
      status: 'succeeded',
      type: 'service',
      concept: '=HYPERLINK("http://evil.example","Ver")',
      paidAt: new Date(),
    });

    const res = await request(app)
      .get('/api/contracts/earnings/export')
      .set('x-user-id', landlordId)
      .set('x-user-role', 'landlord')
      .set('x-user-verified', 'true')
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    const [header, row] = res.text.trim().split('\n');
    expect(header).toBe('Fecha,Concepto,Propiedad,Inquilino,Importe (EUR),Estado,ID Transaccion');
    expect(row).toContain('"\'=HYPERLINK(""http://evil.example"",""Ver"")"');
    expect(row).toContain('"900.00"');
    expect(row).not.toMatch(/,"=/);
  });
});
