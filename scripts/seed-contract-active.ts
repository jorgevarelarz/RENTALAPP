import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Contract } from '../src/models/contract.model';
import { Property } from '../src/models/property.model';
import { User } from '../src/models/user.model';

dotenv.config();

const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/rental-app';

async function main() {
  await mongoose.connect(mongoUrl);
  console.log('Connected to MongoDB');

  const landlord = await User.findOne({ role: 'landlord' });
  const tenant =
    await User.findOne({ email: 'tenant.verified@example.com' }) ||
    await User.findOne({ role: 'tenant' });

  if (!landlord || !tenant) {
    throw new Error('Need at least one landlord and one tenant in the database.');
  }

  let property = await Property.findOne({ owner: landlord._id });
  if (!property) {
    console.log('Landlord has no properties. Creating a sample property.');
    property = await Property.create({
      owner: landlord._id,
      title: 'Apartamento con vistas',
      description: 'Apartamento centrico, reformado y listo para entrar a vivir.',
      address: 'Calle Gran Via 42',
      region: 'madrid',
      city: 'Madrid',
      location: { type: 'Point', coordinates: [-3.7038, 40.4168] },
      price: 1200,
      deposit: 1200,
      availableFrom: new Date(),
      images: [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
      ],
      status: 'active',
    });
    console.log(`Property created: ${property.title}`);
  }

  if (!property) {
    throw new Error('No properties found in the database.');
  }

  await Contract.updateMany(
    { tenant: tenant._id, status: 'active' },
    { $set: { status: 'completed' } },
  );

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 15);
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  const contract = await Contract.create({
    landlord: landlord._id,
    tenant: tenant._id,
    property: property._id,
    status: 'active',
    rent: property.price || 1200,
    deposit: property.price || 1200,
    currency: 'EUR',
    startDate,
    endDate,
    depositPaid: true,
    depositPaidAt: startDate,
    signedByLandlord: true,
    signedByTenant: true,
    signedAt: startDate,
    region: 'general',
    clausePolicyVersion: '1.0.0',
    clauses: [
      { id: 'seed.duration', version: '1.0.0', params: {} },
      { id: 'seed.pets', version: '1.0.0', params: {} },
    ],
  });

  console.log('Active contract created');
  console.log(`Contract ID: ${contract._id}`);
  console.log(`Tenant login: ${tenant.email}`);
  console.log(`Landlord login: ${landlord.email}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
