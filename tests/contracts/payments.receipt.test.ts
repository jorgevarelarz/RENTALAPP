import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import { Contract } from '../../src/models/contract.model';
import { Property } from '../../src/models/property.model';
import { Payment } from '../../src/models/payment.model';
import { describeReceipt } from '../../src/services/rentReceiptPdf';

// Art. 17.4 LAU: el inquilino tiene derecho a recibo de cada renta pagada.
describe('Recibo PDF de un pago', () => {
  const tenantId = new mongoose.Types.ObjectId();
  const landlordId = new mongoose.Types.ObjectId();
  const strangerId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const as = (id: mongoose.Types.ObjectId, role: string) => ({
    'x-user-id': String(id),
    'x-user-role': role,
    'x-user-verified': 'true',
  });

  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  const pdfGet = (url: string, headers: Record<string, string>) =>
    request(app)
      .get(url)
      .set(headers)
      .buffer(true)
      .parse((res, cb) => {
        const data: Buffer[] = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(data)));
      });

  async function seed(paymentExtra: Record<string, unknown> = {}, agencyAccess?: string) {
    await User.create([
      { _id: tenantId, name: 'Lucía Pérez', email: 'lucia@test.com', passwordHash: 'h', role: 'tenant' },
      { _id: landlordId, name: 'Andrés Gil', email: 'andres@test.com', passwordHash: 'h', role: 'landlord' },
    ]);
    const property = await Property.create({
      owner: landlordId,
      title: 'Piso en Chamberí',
      address: 'Calle Fuencarral 120, 3º B',
      city: 'Madrid',
      region: 'madrid',
      location: { type: 'Point', coordinates: [-3.70, 40.43] },
      price: 950,
      deposit: 950,
      sizeM2: 70,
      rooms: 2,
      bathrooms: 1,
      furnished: false,
      petsAllowed: false,
      availableFrom: new Date(),
      ...(agencyAccess ? { agencyId, agencyAccess } : {}),
    } as any);
    const contract = await Contract.create({
      landlord: landlordId,
      tenant: tenantId,
      property: property._id,
      rent: 950,
      deposit: 950,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      region: 'madrid',
      status: 'active',
      ...(agencyAccess ? { agencyId } : {}),
    });
    return Payment.create({
      contract: contract._id,
      payer: tenantId,
      payee: landlordId,
      amount: 950,
      currency: 'eur',
      type: 'rent',
      status: 'succeeded',
      concept: 'Renta octubre 2026',
      billingMonth: 10,
      billingYear: 2026,
      paidAt: new Date('2026-10-03T09:00:00Z'),
      stripeChargeId: 'ch_test_123',
      ...paymentExtra,
    });
  }

  it('inquilino y casero descargan el PDF de una renta cobrada', async () => {
    const payment = await seed();
    for (const headers of [as(tenantId, 'tenant'), as(landlordId, 'landlord')]) {
      const res = await pdfGet(`/api/payments/${payment._id}/receipt.pdf`, headers).expect(200);
      expect(res.headers['content-type']).toMatch(/application\/pdf/);
      expect(res.headers['content-disposition']).toContain(`recibo_R-202610-${String(payment._id).slice(-6).toUpperCase()}.pdf`);
      expect(res.headers['cache-control']).toContain('no-store');
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  it('la agencia gestora lo descarga; quien no es parte recibe 404', async () => {
    const payment = await seed({}, 'manage');
    await pdfGet(`/api/payments/${payment._id}/receipt.pdf`, as(agencyId, 'agency')).expect(200);
    await request(app).get(`/api/payments/${payment._id}/receipt.pdf`).set(as(strangerId, 'tenant')).expect(404);
    await request(app).get(`/api/payments/${payment._id}/receipt.pdf`).set(as(strangerId, 'landlord')).expect(404);
  });

  it('sin cobrar, devuelto, de otro tipo o con id raro no hay recibo', async () => {
    const pending = await seed({ status: 'pending' });
    const r1 = await request(app).get(`/api/payments/${pending._id}/receipt.pdf`).set(as(tenantId, 'tenant')).expect(409);
    expect(r1.body.error).toBe('receipt_not_paid');

    await Payment.updateOne({ _id: pending._id }, { status: 'refunded' });
    const r2 = await request(app).get(`/api/payments/${pending._id}/receipt.pdf`).set(as(tenantId, 'tenant')).expect(409);
    expect(r2.body.error).toBe('receipt_refunded');

    await Payment.updateOne({ _id: pending._id }, { status: 'succeeded', type: 'service' });
    await request(app).get(`/api/payments/${pending._id}/receipt.pdf`).set(as(tenantId, 'tenant')).expect(404);

    await request(app).get('/api/payments/no-es-un-id/receipt.pdf').set(as(tenantId, 'tenant')).expect(404);
  });

  it('el contenido separa el concepto y dice periodo, partes, vivienda y devolución parcial', () => {
    const c = describeReceipt({
      paymentId: '507f1f77bcf86cd799439abc',
      type: 'rent',
      amount: 950,
      amountRefunded: 100,
      refundedAt: new Date('2026-10-10T10:00:00Z'),
      billingMonth: 10,
      billingYear: 2026,
      paidAt: new Date('2026-10-03T09:00:00Z'),
      reference: 'ch_test_123',
      landlordName: 'Andrés Gil',
      tenantName: 'Lucía Pérez',
      propertyAddress: 'Calle Fuencarral 120, 3º B',
      propertyCity: 'Madrid',
    });
    expect(c.number).toBe('R-202610-439ABC');
    expect(c.title).toBe('Recibo de renta');
    expect(c.items).toEqual([['Renta de octubre de 2026', '950,00 €']]);
    expect(c.paidOn).toBe('3 de octubre de 2026');
    expect(c.rows).toEqual(
      expect.arrayContaining([
        ['Arrendador', 'Andrés Gil'],
        ['Arrendatario', 'Lucía Pérez'],
        ['Vivienda', 'Calle Fuencarral 120, 3º B, Madrid'],
        ['Periodo', 'Octubre de 2026'],
        ['Referencia', 'ch_test_123'],
      ]),
    );
    expect(c.refund).toBe('Devuelto el 10 de octubre de 2026: 100,00 €');

    const deposit = describeReceipt({ ...baseDeposit });
    expect(deposit.title).toBe('Recibo de fianza');
    expect(deposit.items[0][0]).toBe('Fianza');
    expect(deposit.rows.find(([k]) => k === 'Periodo')).toBeUndefined();
    expect(deposit.refund).toBeNull();
  });

  const baseDeposit = {
    paymentId: '507f1f77bcf86cd799439def',
    type: 'deposit' as const,
    amount: 1900,
    paidAt: new Date('2026-01-02T09:00:00Z'),
    landlordName: 'A',
    tenantName: 'B',
    propertyAddress: 'C',
  };
});
