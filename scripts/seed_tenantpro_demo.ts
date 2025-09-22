import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/user.model';
import { Property } from '../src/models/property.model';

async function run() {
  dotenv.config();
  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/rental-app';
  await mongoose.connect(mongoUrl);

  const TENANT_EMAIL = process.env.DEMO_TENANT_EMAIL || 'tenant@example.com';
  const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin@example.com';
  const PASSWORD = process.env.DEMO_PASSWORD || 'password';

  // Ensure tenant account
  let tenant = await User.findOne({ email: TENANT_EMAIL });
  if (!tenant) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    tenant = await User.create({ name: 'Demo Tenant', email: TENANT_EMAIL, passwordHash, role: 'tenant' } as any);
  }

  // Ensure admin account
  let admin = await User.findOne({ email: ADMIN_EMAIL });
  if (!admin) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    admin = await User.create({ name: 'Demo Admin', email: ADMIN_EMAIL, passwordHash, role: 'admin' } as any);
  }

  // Pick or create a property and require Tenant PRO
  let property = await Property.findOne({ status: 'active' });
  if (!property) {
    // Fallback minimal property if none exists
    const owner = admin?._id || tenant?._id;
    property = await Property.create({
      owner,
      title: 'Tenant PRO Required Flat',
      description: 'Demo property requiring Tenant PRO validation',
      address: 'Demo Street 123',
      region: 'madrid',
      city: 'Madrid',
      location: { type: 'Point', coordinates: [-3.70379, 40.41678] },
      price: 1200,
      deposit: 1200,
      sizeM2: 70,
      rooms: 2,
      bathrooms: 1,
      furnished: false,
      petsAllowed: false,
      availableFrom: new Date(),
      images: ['https://via.placeholder.com/1000x600?text=Property', 'https://via.placeholder.com/400x300', 'https://via.placeholder.com/400x300?2'],
      status: 'active',
    } as any);
  }

  property.onlyTenantPro = true as any;
  // Require at least the higher of current price or a default threshold
  const required = Math.max(property.price || 0, 1200);
  (property as any).requiredTenantProMaxRent = required;
  await property.save();

  // Output summary
  console.log('Demo accounts and property configured for Tenant PRO flow');
  console.log('--------------------------------------------------------');
  console.log(`Tenant -> email: ${TENANT_EMAIL} | password: ${PASSWORD}`);
  console.log(`Admin  -> email: ${ADMIN_EMAIL}  | password: ${PASSWORD}`);
  console.log(`Property ID: ${property._id}`);
  console.log(`onlyTenantPro: ${property.onlyTenantPro} | requiredTenantProMaxRent: ${required}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

