import crypto from 'crypto';
import Stripe from 'stripe';

// Initialise Stripe client. In production, set STRIPE_SECRET_KEY in your .env.
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
// Stripe API version must match the typings provided by @types/stripe.
// The supported version as of the installed types is '2022-11-15'.
export const stripe = new Stripe(stripeSecret, {
  apiVersion: '2022-11-15',
});

/**
 * Encrypts an IBAN using AES‑256‑CBC. Requires a 32‑byte (64 hex chars)
 * encryption key set in the IBAN_ENCRYPTION_KEY environment variable. The
 * returned string is IV:encryptedHex.
 */
export const encryptIBAN = (iban: string): string => {
  const keyHex = process.env.IBAN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('IBAN_ENCRYPTION_KEY no está definido');
  }
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(iban, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

/**
 * Decrypts an encrypted IBAN back to plain text. Expects the same
 * IBAN_ENCRYPTION_KEY used in encryptIBAN.
 */
export const decryptIBAN = (encryptedIban: string): string => {
  const [ivHex, encrypted] = encryptedIban.split(':');
  const keyHex = process.env.IBAN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('IBAN_ENCRYPTION_KEY no está definido');
  }
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

/**
 * Creates a Stripe customer and attaches a SEPA Direct Debit mandate using
 * the provided IBAN. Returns the created customer ID. Note: this is a
 * placeholder and will only work if the Stripe secret key is properly
 * configured and the environment allows outbound network calls.
 */
export const createCustomerAndMandate = async (
  name: string,
  email: string,
  iban: string,
): Promise<string> => {
  const customer = await stripe.customers.create({ name, email });
  // Attach a SEPA debit source to the customer. The Stripe typings require using
  // customers.createSource rather than the deprecated customerSources API.
  await stripe.customers.createSource(customer.id, {
    source: {
      object: 'source',
      type: 'sepa_debit',
      sepa_debit: { iban },
      currency: 'eur',
      owner: { name, email },
    },
  } as any);
  return customer.id;
};

/**
 * Creates a payment intent to collect rent or deposit. The caller must
 * specify the Stripe customer ID obtained via createCustomerAndMandate.
 */
export const createPaymentIntent = async (
  customerId: string,
  amount: number,
  currency = 'eur',
) => {
  return stripe.paymentIntents.create({
    customer: customerId,
    amount: Math.round(amount * 100), // convert to cents
    currency,
    payment_method_types: ['sepa_debit'],
    confirm: true,
  });
};