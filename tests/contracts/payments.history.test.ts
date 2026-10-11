import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { Contract } from '../../src/models/contract.model';
import { Property } from '../../src/models/property.model';
import { Payment } from '../../src/models/payment.model';
import { ContractParty } from '../../src/models/contractParty.model';

// Lista de cobros del contrato: de aquí sale «Descargar recibo» en el detalle del contrato.
describe('GET /api/contracts/:id/payments', () => {
  const tenantId = new mongoose.Types.ObjectId();
  const landlordId = new mongoose.Types.ObjectId();
  const agencyId = new mongoose.Types.ObjectId();
  const coTenantId = new mongoose.Types.ObjectId();
  const invitedId = new mongoose.Types.ObjectId();
  const strangerId = new mongoose.Types.ObjectId();
  const as = (id: mongoose.Types.ObjectId, role: string) => ({
    'x-user-id': String(id),
    'x-user-role': role,
    'x-user-verified': 'true',
  });

  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  async function seed() {
    const property = await Property.create({
      owner: landlordId,
      title: 'Piso en Chamberí',
      address: 'Calle Fuencarral 120, 3º B',
      city: 'Madrid',
      region: 'madrid',
      location: { type: 'Point', coordinates: [-3.7, 40.43] },
      price: 950,
      deposit: 950,
      sizeM2: 70,
      rooms: 2,
      bathrooms: 1,
      furnished: false,
      petsAllowed: false,
      availableFrom: new Date(),
      agencyId,
      agencyAccess: 'manage',
    } as any);
    const contract = await Contract.create({
      landlord: landlordId,
      tenant: tenantId,
      property: property._id,
      agencyId,
      rent: 950,
      deposit: 950,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      region: 'madrid',
      status: 'active',
    });
    const base = { contract: contract._id, payer: tenantId, payee: landlordId, currency: 'eur' };
    await Payment.create([
      { ...base, amount: 950, type: 'deposit', status: 'succeeded', concept: 'Fianza', paidAt: new Date('2026-01-02'), stripePaymentIntentId: 'pi_dep' },
      { ...base, amount: 950, type: 'rent', status: 'succeeded', concept: 'Renta', billingMonth: 9, billingYear: 2026, paidAt: new Date('2026-09-03'), stripeChargeId: 'ch_sep' },
      { ...base, amount: 950, type: 'rent', status: 'succeeded', concept: 'Renta', billingMonth: 10, billingYear: 2026, paidAt: new Date('2026-10-03'), amountRefunded: 50 },
      { ...base, amount: 950, type: 'rent', status: 'pending', concept: 'Renta', billingMonth: 11, billingYear: 2026 },
      { ...base, amount: 950, type: 'rent', status: 'refunded', concept: 'Renta', billingMonth: 8, billingYear: 2026, paidAt: new Date('2026-08-03') },
      { ...base, amount: 120, type: 'service', status: 'succeeded', concept: 'Fontanero', paidAt: new Date('2026-10-05') },
    ]);
    await ContractParty.create([
      { contractId: contract._id, role: 'TENANT', email: 'co@test.com', status: 'JOINED', userId: coTenantId },
      { contractId: contract._id, role: 'TENANT', email: 'inv@test.com', status: 'INVITED', userId: invitedId },
    ]);
    return contract;
  }

  it('devuelve solo rentas y fianza cobradas, la más reciente primero y sin datos de Stripe', async () => {
    const contract = await seed();
    const res = await request(app).get(`/api/contracts/${contract._id}/payments`).set(as(landlordId, 'landlord')).expect(200);
    expect(res.body.map((p: any) => p.type === 'deposit' ? 'fianza' : `${p.billingMonth}/${p.billingYear}`)).toEqual([
      '10/2026',
      '9/2026',
      'fianza',
    ]);
    expect(res.body[0].amountRefunded).toBe(50);
    for (const p of res.body) {
      expect(p.stripeChargeId).toBeUndefined();
      expect(p.stripePaymentIntentId).toBeUndefined();
      expect(p.payer).toBeUndefined();
    }
  });

  it('lo ven inquilino, co-titular activo, agencia gestora y admin; nadie más', async () => {
    const contract = await seed();
    const url = `/api/contracts/${contract._id}/payments`;
    for (const headers of [
      as(tenantId, 'tenant'),
      as(coTenantId, 'tenant'),
      as(agencyId, 'agency'),
      as(strangerId, 'admin'),
    ]) {
      const res = await request(app).get(url).set(headers).expect(200);
      expect(res.body).toHaveLength(3);
    }
    await request(app).get(url).set(as(invitedId, 'tenant')).expect(403);
    await request(app).get(url).set(as(strangerId, 'landlord')).expect(403);

    await Property.updateOne({ _id: contract.property }, { agencyAccess: 'status_only' });
    await request(app).get(url).set(as(agencyId, 'agency')).expect(403);
  });

  it('un contrato inexistente o un id raro dan 404', async () => {
    await request(app).get(`/api/contracts/${new mongoose.Types.ObjectId()}/payments`).set(as(tenantId, 'tenant')).expect(404);
    await request(app).get('/api/contracts/no-es-un-id/payments').set(as(tenantId, 'tenant')).expect(404);
  });
});
