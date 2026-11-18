/**
 * Crea el pago de fianza (`Payment` tipo `deposit`) de las fianzas cobradas antes de que el
 * webhook lo guardara, para que tengan recibo y salgan en «Cobros y recibos».
 *
 *   npx ts-node scripts/backfill_deposit_payments.ts           # prueba: solo cuenta
 *   npx ts-node scripts/backfill_deposit_payments.ts --apply   # escribe
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { backfillDepositPayments } from '../src/services/depositPayment.service';

dotenv.config();

async function main() {
  const apply = process.argv.includes('--apply');
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/rentalapp';
  await mongoose.connect(mongoUri);
  const result = await backfillDepositPayments({ apply });
  console.log(apply ? 'Pagos de fianza creados:' : 'Pagos de fianza que se crearían (prueba, sin --apply):', result.created.length);
  if (result.created.length) console.log('  contratos:', result.created.join(', '));
  if (result.withoutIntent.length) {
    console.log('Fianzas pagadas sin PaymentIntent guardado (revisar en Stripe):', result.withoutIntent.join(', '));
  }
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
