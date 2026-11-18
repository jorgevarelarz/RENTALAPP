import mongoose from 'mongoose';
import { User } from '../../src/models/user.model';
import { stripe } from '../../src/utils/stripe';

/**
 * Deja al propietario con su cuenta de Stripe Connect lista para recibir transferencias.
 * Los cobros de renta lo exigen (services/rentCharge.service). Llamar en `beforeEach` o dentro
 * del test: `jest.restoreAllMocks()` deshace el espía de `accounts.retrieve`.
 */
export async function connectLandlord(
  landlordId: string,
  { accountId = 'acct_test_owner', transfers = 'active' }: { accountId?: string | null; transfers?: string } = {},
) {
  await User.updateOne(
    { _id: new mongoose.Types.ObjectId(landlordId) },
    {
      ...(accountId ? { $set: { stripeAccountId: accountId } } : { $unset: { stripeAccountId: 1 } }),
      $setOnInsert: {
        name: 'Propietaria',
        email: `propietaria-${landlordId}@test.com`,
        passwordHash: 'hash',
        role: 'landlord',
      },
    },
    { upsert: true },
  );
  return jest
    .spyOn(stripe.accounts, 'retrieve')
    .mockImplementation((async (id: string) => ({ id, capabilities: { transfers } })) as any);
}
