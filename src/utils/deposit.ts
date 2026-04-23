import https from 'https';
import http from 'http';
import { stripe } from './stripe';
import { isProd, isMock } from '../config/flags';
import { logger } from './logger';

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
function postJson(url: string, payload: object, apiKey?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const parsed = new URL(url);
    const options: https.RequestOptions = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    };
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(Object.assign(new Error(`Authority API returned ${res.statusCode}`), { status: 502 }));
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10_000, () => {
      req.destroy();
      reject(Object.assign(new Error('Authority API timeout'), { status: 504 }));
    });
    req.write(body);
    req.end();
  });
}

export const depositToAuthority = async (contractId: string, amount: number): Promise<void> => {
  const authorityUrl = process.env.DEPOSIT_AUTHORITY_API_URL;

  if (!authorityUrl) {
    if (isProd()) {
      throw Object.assign(
        new Error('DEPOSIT_AUTHORITY_API_URL requerido en producción'),
        { status: 503 },
      );
    }
    logger.warn('[deposit] DEPOSIT_AUTHORITY_API_URL no configurado — simulando depósito', { contractId, amount });
    await new Promise(resolve => setTimeout(resolve, 200));
    return;
  }

  const apiKey = process.env.DEPOSIT_AUTHORITY_API_KEY;
  logger.info('[deposit] Enviando depósito a autoridad', { contractId, amount });
  await postJson(authorityUrl, { contractId, amount, currency: 'EUR' }, apiKey);
  logger.info('[deposit] Depósito enviado correctamente', { contractId });
};
