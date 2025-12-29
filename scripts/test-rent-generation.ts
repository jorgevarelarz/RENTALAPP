import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Contract } from '../src/models/contract.model';
import { Payment } from '../src/models/payment.model';
import { runRentGeneration } from '../src/jobs/rentGeneration.job';

dotenv.config();

async function main() {
  try {
    console.log('Starting rent generation test...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rentalapp');

    const contract = await Contract.findOne({ status: 'active' }).lean();
    if (!contract) {
      console.log('No active contracts found. Test skipped.');
      return;
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const beforeCount = await Payment.countDocuments({
      contract: contract._id,
      type: 'rent',
      billingMonth: currentMonth,
      billingYear: currentYear,
    });

    console.log(`Before run: ${beforeCount} rent payments for ${currentMonth}/${currentYear}`);

    await runRentGeneration();

    const afterCount = await Payment.countDocuments({
      contract: contract._id,
      type: 'rent',
      billingMonth: currentMonth,
      billingYear: currentYear,
    });

    console.log(`After run: ${afterCount} rent payments for ${currentMonth}/${currentYear}`);
    if (afterCount > beforeCount) {
      console.log('Success: a new rent payment was generated.');
    } else {
      console.log('No new payment generated (it may already exist).');
    }
  } catch (error) {
    console.error('Rent generation test failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
