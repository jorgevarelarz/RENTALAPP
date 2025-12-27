import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/user.model';
import { Verification } from '../src/models/verification.model';

dotenv.config();

const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI || 'mongodb://localhost:27017/rental-app';
const password = 'password';

async function ensureUser(email: string, role: 'tenant' | 'landlord') {
  let user = await User.findOne({ email });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await User.create({
      name: role === 'tenant' ? 'Inquilino Verificado' : 'Propietario Verificado',
      email,
      passwordHash,
      role,
    });
  }
  await Verification.findOneAndUpdate(
    { userId: String(user._id) },
    { $set: { status: 'verified' } },
    { upsert: true, new: true },
  );
  return user;
}

async function main() {
  await mongoose.connect(mongoUrl);
  const tenant = await ensureUser('tenant.verified@example.com', 'tenant');
  const landlord = await ensureUser('landlord.verified@example.com', 'landlord');
  console.log('Users ready');
  console.log(`Tenant -> ${tenant.email} / ${password} (verified)`);
  console.log(`Landlord -> ${landlord.email} / ${password} (verified)`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
