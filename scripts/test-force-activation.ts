import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Contract } from '../src/models/contract.model';
import { Property } from '../src/models/property.model';
import { User } from '../src/models/user.model';
import { transitionContract } from '../src/services/contractState';

dotenv.config();

async function runTest() {
  try {
    console.log('Starting activation email test...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rentalapp');

    const landlord = await User.findOne({ role: 'landlord' });
    const tenant = await User.findOne({ role: 'tenant' });
    const property = await Property.findOne();

    if (!landlord || !tenant || !property) {
      throw new Error('Missing landlord, tenant, or property data for the test.');
    }

    console.log(`Email will be sent to: ${tenant.email}`);

    const contract = await Contract.create({
      landlord: landlord._id,
      tenant: tenant._id,
      property: property._id,
      rent: 950,
      deposit: 950,
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      status: 'signed',
      depositPaid: true,
      region: 'general',
    });

    console.log(`Temporary contract created: ${contract.id} (status: ${contract.status})`);

    console.log('Triggering transitionContract()...');
    const updatedContract = await transitionContract(contract.id, 'active');

    console.log(`Final status: ${updatedContract.status}`);
    if (updatedContract.status === 'active') {
      console.log('Success: contract is active. Check logs for email output.');
    }
  } catch (error) {
    console.error('Activation email test failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
