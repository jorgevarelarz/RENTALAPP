import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { User } from '../../src/models/user.model';
import { Property } from '../../src/models/property.model';
import { Contract } from '../../src/models/contract.model';
import { AgencyInvite } from '../../src/models/agencyInvite.model';
import { Verification } from '../../src/models/verification.model';
import {
  parseShareTiers,
  pctForActiveCount,
  nextTierFor,
} from '../../src/services/agencyShare.service';

const AGENCY_ID = '6500000000000000000000a1';
const TENANT_B = '6500000000000000000000b1';
const TENANT_C = '6500000000000000000000c1';

describe('Agency landlord referral (captación)', () => {
  beforeAll(connectDb);
  afterAll(disconnectDb);
  afterEach(clearDb);

  const makeAgency = () =>
    User.create({
      _id: new mongoose.Types.ObjectId(AGENCY_ID),
      name: 'Inmo Test',
      email: 'agency@test.com',
      passwordHash: 'hash',
      role: 'agency',
      isVerified: true,
    });

  const makeTenant = (id: string, email: string) =>
    User.create({
      _id: new mongoose.Types.ObjectId(id),
      name: 'Tenant',
      email,
      passwordHash: 'hash',
      role: 'tenant',
      isVerified: true,
    });

  const inviteAndAccept = async () => {
    const inviteRes = await request(app)
      .post('/api/agency/landlords/invite')
      .set('x-user-id', AGENCY_ID)
      .set('x-user-role', 'agency')
      .send({ landlordName: 'Paco Prop', landlordEmail: 'paco@test.com', propertyAddress: 'Calle Real 1' })
      .expect(201);

    const token = inviteRes.body.invite.inviteUrl.split('/invite/')[1];
    const acceptRes = await request(app)
      .post(`/api/agency-invites/${token}/accept`)
      .send({ password: 'supersegura1' })
      .expect(201);
    return acceptRes.body.user._id as string;
  };

  it('invite → accept crea landlord con referredByAgencyId', async () => {
    await makeAgency();
    const landlordId = await inviteAndAccept();

    const landlord: any = await User.findById(landlordId).lean();
    expect(landlord.role).toBe('landlord');
    expect(String(landlord.referredByAgencyId)).toBe(AGENCY_ID);

    const invite: any = await AgencyInvite.findOne({ landlordEmail: 'paco@test.com' }).lean();
    expect(invite.status).toBe('accepted');
    expect(String(invite.landlordId)).toBe(landlordId);
  });

  it('no permite invitar a un email ya registrado (primer toque gana)', async () => {
    await makeAgency();
    await User.create({ name: 'Ya Existe', email: 'paco@test.com', passwordHash: 'h', role: 'landlord' });
    await request(app)
      .post('/api/agency/landlords/invite')
      .set('x-user-id', AGENCY_ID)
      .set('x-user-role', 'agency')
      .send({ landlordName: 'Paco', landlordEmail: 'paco@test.com' })
      .expect(409);
  });

  it('propiedad creada por landlord referido hereda refAgencyId', async () => {
    await makeAgency();
    const landlordId = await inviteAndAccept();

    const res = await request(app)
      .post('/api/properties')
      .set('x-user-id', landlordId)
      .set('x-user-role', 'landlord')
      .send({
        owner: landlordId,
        title: 'Piso captado',
        address: 'Calle Real 1',
        region: 'galicia',
        city: 'A Coruña',
        location: { lng: -8.4, lat: 43.36 },
        price: 800,
        deposit: 800,
        sizeM2: 70,
        rooms: 3,
        bathrooms: 1,
        furnished: false,
        petsAllowed: true,
        availableFrom: '2026-08-01',
        images: ['https://cdn/x1.jpg', 'https://cdn/x2.jpg', 'https://cdn/x3.jpg'],
      })
      .expect(201);

    const prop: any = await Property.findById(res.body._id).lean();
    expect(String(prop.refAgencyId)).toBe(AGENCY_ID);
  });

  it('contrato: primer inquilino y renovación heredan refAgencyId; inquilino nuevo la corta', async () => {
    await makeAgency();
    const landlordId = await inviteAndAccept();
    await makeTenant(TENANT_B, 'tb@test.com');
    await makeTenant(TENANT_C, 'tc@test.com');

    const property = await Property.create({
      owner: new mongoose.Types.ObjectId(landlordId),
      refAgencyId: new mongoose.Types.ObjectId(AGENCY_ID),
      title: 'Piso captado',
      description: 'desc',
      address: 'Calle Real 1',
      region: 'galicia',
      city: 'A Coruña',
      location: { type: 'Point', coordinates: [-8.4, 43.36] },
      price: 800,
      deposit: 800,
      availableFrom: new Date(),
      images: [],
      status: 'active',
    });

    const makeContractReq = (tenantId: string, start: string, end: string) =>
      request(app)
        .post('/api/contracts')
        .set('x-user-id', landlordId)
        .set('x-user-role', 'landlord')
        .send({
          landlord: landlordId,
          tenant: tenantId,
          property: String(property._id),
          region: 'galicia',
          rent: 800,
          deposit: 800,
          startDate: start,
          endDate: end,
          clauses: [],
        });

    // Primer contrato con inquilino B → atribuido
    const c1 = await makeContractReq(TENANT_B, '2026-08-01', '2027-08-01').expect(201);
    const contract1: any = await Contract.findById(c1.body.contract._id).lean();
    expect(String(contract1.refAgencyId)).toBe(AGENCY_ID);

    // Renovación con el mismo inquilino → sigue atribuido
    const c2 = await makeContractReq(TENANT_B, '2027-08-01', '2028-08-01').expect(201);
    const contract2: any = await Contract.findById(c2.body.contract._id).lean();
    expect(String(contract2.refAgencyId)).toBe(AGENCY_ID);

    // Inquilino nuevo → la atribución desaparece
    const c3 = await makeContractReq(TENANT_C, '2028-09-01', '2029-09-01').expect(201);
    const contract3: any = await Contract.findById(c3.body.contract._id).lean();
    expect(contract3.refAgencyId).toBeUndefined();
  });

  it('funnel de la agencia refleja los pasos del propietario', async () => {
    await makeAgency();
    const landlordId = await inviteAndAccept();
    await Verification.create({ userId: landlordId, status: 'verified', method: 'dni' });

    const res = await request(app)
      .get('/api/agency/landlords')
      .set('x-user-id', AGENCY_ID)
      .set('x-user-role', 'agency')
      .expect(200);

    expect(res.body.items).toHaveLength(1);
    const item = res.body.items[0];
    expect(item.status).toBe('accepted');
    expect(item.steps.accountCreated).toBe(true);
    expect(item.steps.kycVerified).toBe(true);
    expect(item.steps.hasProperty).toBe(false);
  });
});

describe('Share tiers (tramos por volumen)', () => {
  it('parsea y ordena AGENCY_SHARE_TIERS', () => {
    const tiers = parseShareTiers('20:25,1:15,10:20,30:30');
    expect(tiers).toEqual([
      { minCount: 1, pct: 15 },
      { minCount: 10, pct: 20 },
      { minCount: 20, pct: 25 },
      { minCount: 30, pct: 30 },
    ]);
  });

  it('aplica el tramo correcto a toda la cartera', () => {
    const tiers = parseShareTiers('1:15,10:20,20:25,30:30');
    expect(pctForActiveCount(0, tiers, 20)).toBe(0);
    expect(pctForActiveCount(1, tiers, 20)).toBe(15);
    expect(pctForActiveCount(9, tiers, 20)).toBe(15);
    expect(pctForActiveCount(10, tiers, 20)).toBe(20);
    expect(pctForActiveCount(25, tiers, 20)).toBe(25);
    expect(pctForActiveCount(31, tiers, 20)).toBe(30);
  });

  it('devuelve fallback sin tramos configurados y calcula el siguiente tramo', () => {
    expect(pctForActiveCount(5, [], 20)).toBe(20);
    const tiers = parseShareTiers('1:15,10:20');
    expect(nextTierFor(5, tiers)).toEqual({ minCount: 10, pct: 20 });
    expect(nextTierFor(15, tiers)).toBeNull();
  });
});
