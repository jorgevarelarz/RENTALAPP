import { stripe } from './stripe';
import { isProd, isMock } from '../config/flags';

/**
 * Creates a Stripe Checkout Session to collect the deposit.
 * Returns the session URL that the user should be redirected to.
 *
 * @param contractId The ID of the contract for which the deposit is paid.
 * @param amount The amount of the deposit in EUR.
 * @param successUrl The URL to redirect the user to after a successful payment.
 * @param cancelUrl The URL to redirect the user to after a canceled payment.
 */
export const depositToEscrow = async (
  contractId: string,
  amount: number,
  successUrl: string,
  cancelUrl: string
): Promise<string> => {
  if (isMock(process.env.ESCROW_DRIVER)) {
    if (isProd()) {
      throw Object.assign(new Error('escrow_mock_not_allowed_in_prod'), { status: 503 });
    }
    return `https://mock.checkout/${contractId}-${Date.now()}`;
  }
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Depósito para contrato ${contractId}`,
          },
          unit_amount: amount * 100, // amount in cents
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      contractId,
      deposit: 'true',
    },
  });

  if (!session.url) {
    throw new Error('Could not create Stripe Checkout session');
  }

  return session.url;
};

/**
 * Simulates sending a deposit to a public authority for safekeeping. This
 * should be used if the law in your jurisdiction requires that rental
 * deposits be deposited with a governmental body (e.g. regional housing
 * agency). In production this would perform an HTTP request to the
 * authority's API or use another integration channel.
 *
 * @param contractId The ID of the contract for which the deposit is paid.
 * @param amount The amount of the deposit in EUR.
 */
export const depositToAuthority = async (contractId: string, amount: number): Promise<void> => {
  // TODO: integrate with the public authority's API here
  console.log(
    `Simulating deposit of €${amount} for contract ${contractId} to the public authority.`,
  );
  await new Promise(resolve => setTimeout(resolve, 500));
};
