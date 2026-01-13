import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { Contract } from '../src/models/contract.model';
import { Property } from '../src/models/property.model';
import { RentalPriceHistory } from '../src/modules/rentalPublic/models/rentalPriceHistory.model';
import { upsertTensionedArea, evaluateAndPersist } from '../src/modules/rentalPublic';

async function main() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/rental-app';
  await mongoose.connect(mongoUrl);

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  await upsertTensionedArea({
    region: 'galicia',
    city: 'oleiros',
    zoneCode: '',
    source: 'demo',
    effectiveFrom: new Date(now.getTime() - 60 * dayMs),
  });

  await upsertTensionedArea({
    region: 'madrid',
    city: 'madrid',
    zoneCode: 'centro',
    source: 'demo',
    effectiveFrom: new Date(now.getTime() - 120 * dayMs),
  });

  const ownerId = new Types.ObjectId();
  const landlordId = new Types.ObjectId();
  const tenantId = new Types.ObjectId();

  const properties = await Property.create([
    {
      owner: ownerId,
      title: 'Demo Oleiros 1',
      address: 'Avenida del Faro 12',
      region: 'galicia',
      city: 'oleiros',
      location: { type: 'Point', coordinates: [-8.35, 43.35] },
      price: 900,
      deposit: 900,
      availableFrom: now,
      status: 'active',
    },
    {
      owner: ownerId,
      title: 'Demo Oleiros 2',
      address: 'Rua Praia 5',
      region: 'galicia',
      city: 'oleiros',
      location: { type: 'Point', coordinates: [-8.34, 43.34] },
      price: 950,
      deposit: 950,
      availableFrom: now,
      status: 'active',
    },
    {
      owner: ownerId,
      title: 'Demo Madrid Centro',
      address: 'Calle Mayor 44',
      region: 'madrid',
      city: 'madrid',
      location: { type: 'Point', coordinates: [-3.703, 40.416] },
      price: 1200,
      deposit: 1200,
      availableFrom: now,
      status: 'active',
    },
    {
      owner: ownerId,
      title: 'Demo Santiago',
      address: 'Rua Nova 3',
      region: 'galicia',
      city: 'santiago',
      location: { type: 'Point', coordinates: [-8.546, 42.88] },
      price: 700,
      deposit: 700,
      availableFrom: now,
      status: 'active',
    },
    {
      owner: ownerId,
      title: 'Demo Valencia',
      address: 'Carrer de la Mar 18',
      region: 'valencia',
      city: 'valencia',
      location: { type: 'Point', coordinates: [-0.377, 39.469] },
      price: 820,
      deposit: 820,
      availableFrom: now,
      status: 'active',
    },
    {
      owner: ownerId,
      title: 'Demo Bilbao',
      address: 'Gran Via 20',
      region: 'euskadi',
      city: 'bilbao',
      location: { type: 'Point', coordinates: [-2.935, 43.263] },
      price: 980,
      deposit: 980,
      availableFrom: now,
      status: 'active',
    },
  ]);

  const baseHistory = [900, 920, 1100, 700, 820, 980];
  for (let i = 0; i < properties.length; i += 1) {
    await RentalPriceHistory.create({
      property: properties[i]._id,
      previousRent: baseHistory[i] - 50,
      newRent: baseHistory[i],
      changeDate: new Date(now.getTime() - 180 * dayMs),
      reason: 'demo_seed',
      source: 'demo',
    });
  }

  const contracts = await Contract.create([
    {
      landlord: landlordId,
      tenant: tenantId,
      property: properties[0]._id,
      rent: 1000,
      deposit: 1000,
      startDate: new Date(now.getTime() - 10 * dayMs),
      endDate: new Date(now.getTime() + 355 * dayMs),
      region: 'galicia',
      status: 'draft',
    },
    {
      landlord: landlordId,
      tenant: tenantId,
      property: properties[1]._id,
      rent: 980,
      deposit: 980,
      startDate: new Date(now.getTime() - 12 * dayMs),
      endDate: new Date(now.getTime() + 353 * dayMs),
      region: 'galicia',
      status: 'draft',
    },
    {
      landlord: landlordId,
      tenant: tenantId,
      property: properties[2]._id,
      rent: 1350,
      deposit: 1350,
      startDate: new Date(now.getTime() - 14 * dayMs),
      endDate: new Date(now.getTime() + 351 * dayMs),
      region: 'madrid',
      status: 'draft',
    },
    {
      landlord: landlordId,
      tenant: tenantId,
      property: properties[3]._id,
      rent: 700,
      deposit: 700,
      startDate: new Date(now.getTime() - 15 * dayMs),
      endDate: new Date(now.getTime() + 350 * dayMs),
      region: 'galicia',
      status: 'draft',
    },
    {
      landlord: landlordId,
      tenant: tenantId,
      property: properties[4]._id,
      rent: 820,
      deposit: 820,
      startDate: new Date(now.getTime() - 16 * dayMs),
      endDate: new Date(now.getTime() + 349 * dayMs),
      region: 'valencia',
      status: 'draft',
    },
    {
      landlord: landlordId,
      tenant: tenantId,
      property: properties[5]._id,
      rent: 980,
      deposit: 980,
      startDate: new Date(now.getTime() - 18 * dayMs),
      endDate: new Date(now.getTime() + 347 * dayMs),
      region: 'euskadi',
      status: 'draft',
    },
  ]);

  for (const contract of contracts) {
    await evaluateAndPersist(String(contract._id), { changeDate: contract.startDate });
  }

  console.log('Seeded Rental Public demo data:', {
    tensionedAreas: 2,
    properties: properties.length,
    contracts: contracts.length,
  });

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
