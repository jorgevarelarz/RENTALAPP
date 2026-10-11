import { stripe } from './stripe';
import { isProd, isMock } from '../config/flags';

export interface DepositCheckout {
  id: string;
  url: string | null;
  status: 'open' | 'complete' | 'expired';
}

/**
 * Creates a Stripe Checkout Session to collect the deposit.
 *
 * @param contractId The ID of the contract for which the deposit is paid.
 * @param amount The amount of the deposit in EUR.
 * @param successUrl The URL to redirect the user to after a successful payment.
 * @param cancelUrl The URL to redirect the user to after a canceled payment.
 * @param idempotencyKey Same key → same session, so concurrent requests cannot open two checkouts.
 */
export const depositToEscrow = async (
  contractId: string,
  amount: number,
  successUrl: string,
  cancelUrl: string,
  idempotencyKey?: string,
): Promise<DepositCheckout> => {
  if (isMock(process.env.ESCROW_DRIVER)) {
    if (isProd()) {
      throw Object.assign(new Error('escrow_mock_not_allowed_in_prod'), { status: 503 });
    }
    return { id: `cs_mock_${contractId}`, url: `https://mock.checkout/${contractId}`, status: 'open' };
  }
  const session = await stripe.checkout.sessions.create(
    {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Depósito para contrato ${contractId}`,
            },
            unit_amount: Math.round(amount * 100), // amount in cents
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
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );

  if (!session.url) {
    throw new Error('Could not create Stripe Checkout session');
  }

  return { id: session.id, url: session.url, status: (session.status || 'open') as DepositCheckout['status'] };
};

/** Reads an existing deposit Checkout Session (to reuse it while still open). */
export const getDepositCheckout = async (sessionId: string): Promise<DepositCheckout> => {
  if (isMock(process.env.ESCROW_DRIVER)) {
    if (isProd()) {
      throw Object.assign(new Error('escrow_mock_not_allowed_in_prod'), { status: 503 });
    }
    const contractId = sessionId.replace(/^cs_mock_/, '');
    return { id: sessionId, url: `https://mock.checkout/${contractId}`, status: 'open' };
  }
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return { id: session.id, url: session.url, status: (session.status || 'expired') as DepositCheckout['status'] };
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
