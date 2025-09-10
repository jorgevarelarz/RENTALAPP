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

  const p1 = await Property.create({
    title: 'Demo Apartment',
    description: 'Nice flat',
    price: 500,
    address: 'Demo street 1',
    photos: [],
    ownerId: landlord.id,
    status: 'published',
  });
  const p2 = await Property.create({
    title: 'Second Property',
    description: 'Great house',
    price: 800,
    address: 'Sample avenue 2',
    photos: [],
    ownerId: landlord.id,
    status: 'published',
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
