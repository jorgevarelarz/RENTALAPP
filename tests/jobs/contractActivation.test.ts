import { Types } from 'mongoose';
import { connectDb, disconnectDb, clearDb } from '../utils/db';
import { runDailyActivation } from '../../src/jobs/contractActivation.job';
import { Contract } from '../../src/models/contract.model';
import { User } from '../../src/models/user.model';
import { Property } from '../../src/models/property.model';

const createUser = async (role: 'tenant' | 'landlord', email: string) => {
  return User.create({
    name: role === 'tenant' ? 'Tenant' : 'Landlord',
    email,
    passwordHash: 'hashed',
    role,
  });
};

const createProperty = async (ownerId: Types.ObjectId) => {
  return Property.create({
    owner: ownerId,
    title: 'Test Property',
    address: 'Main St 1',
    region: 'madrid',
    city: 'Madrid',
    location: { type: 'Point', coordinates: [0, 0] },
    price: 1000,
    deposit: 1000,
    availableFrom: new Date(),
  });
};

describe('Job: Contract Activation', () => {
  beforeAll(async () => {
    await connectDb();
  });

  afterEach(async () => {
    await clearDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('activates signed contracts with deposit paid when start date has passed', async () => {
    const landlord = await createUser('landlord', 'owner@test.com');
    const tenant = await createUser('tenant', 'tenant@test.com');
    const property = await createProperty(landlord._id);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const contract = await Contract.create({
      landlord: landlord._id,
      tenant: tenant._id,
      property: property._id,
      rent: 1000,
      deposit: 1000,
      startDate: yesterday,
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      region: 'general',
      clauses: [],
      status: 'signed',
      depositPaid: true,
      signedAt: new Date(),
    });

    await runDailyActivation();

    const updatedContract = await Contract.findById(contract._id);
    expect(updatedContract?.status).toBe('active');
  });

  it('does not activate signed contracts with a future start date', async () => {
    const landlord = await createUser('landlord', 'owner2@test.com');
    const tenant = await createUser('tenant', 'tenant2@test.com');
    const property = await createProperty(landlord._id);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const contract = await Contract.create({
      landlord: landlord._id,
      tenant: tenant._id,
      property: property._id,
      rent: 1000,
      deposit: 1000,
      startDate: tomorrow,
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      region: 'general',
      clauses: [],
      status: 'signed',
      depositPaid: true,
      signedAt: new Date(),
    });

    await runDailyActivation();

    const updatedContract = await Contract.findById(contract._id);
    expect(updatedContract?.status).toBe('signed');
  });

  it('does not activate signed contracts when deposit has not been paid', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const contract = new Contract({
      landlord: new Types.ObjectId(),
      tenant: new Types.ObjectId(),
      property: new Types.ObjectId(),
      rent: 800,
      deposit: 800,
      startDate: yesterday,
      endDate: new Date(2026, 1, 1),
      status: 'signed',
      depositPaid: false,
      signedAt: new Date(),
      region: 'general',
    });

    await contract.save({ validateBeforeSave: false });

    await runDailyActivation();

    const check = await Contract.findById(contract._id);
    expect(check?.status).toBe('signed');
    expect(check?.status).not.toBe('active');
  });
});
