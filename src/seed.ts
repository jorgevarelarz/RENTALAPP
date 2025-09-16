import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from './models/user.model';
import { Property } from './models/property.model';

async function main() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/rental-app';
  await mongoose.connect(mongoUrl);

  const email = 'landlord@example.com';
  const password = 'password';
  let landlord = await User.findOne({ email });
  if (!landlord) {
    const passwordHash = await bcrypt.hash(password, 10);
    landlord = await User.create({ name: 'Demo Landlord', email, passwordHash, role: 'landlord' });
  }

  const baseProperty = {
    owner: landlord.id,
    description: 'Nice flat',
    address: 'Demo street 1',
    region: 'madrid',
    city: 'Madrid',
    location: { type: 'Point', coordinates: [-3.70379, 40.41678] },
    price: 500,
    deposit: 500,
    sizeM2: 70,
    rooms: 2,
    bathrooms: 1,
    furnished: false,
    petsAllowed: false,
    availableFrom: new Date(),
    images: ['https://example.com/p1.jpg', 'https://example.com/p2.jpg', 'https://example.com/p3.jpg'],
    status: 'active',
  };

  const p1 = await Property.create({ ...baseProperty, title: 'Demo Apartment' });
  const p2 = await Property.create({
    ...baseProperty,
    title: 'Second Property',
    address: 'Sample avenue 2',
    price: 800,
    deposit: 800,
    location: { type: 'Point', coordinates: [-3.69, 40.41] },
  });

  console.log('Seed completed');
  console.log(`Landlord credentials -> email: ${email} password: ${password}`);
  console.log(`Properties created: ${p1.id}, ${p2.id}`);
  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
