import crypto from 'crypto';
import Stripe from 'stripe';
import { isProd, isMock } from '../config/flags';

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
 * the provided IBAN. Returns the created customer ID.
 */
export const createCustomerAndMandate = async (
  name: string,
  email: string,
  iban: string,
): Promise<string> => {
  const customer = await stripe.customers.create({ name, email });
  // Attach a SEPA debit source to the customer.
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

export interface HoldArgs {
  customerId: string;
  amount: number;                 // gross amount to hold (EUR units)
  currency?: 'eur';
  meta?: any;
}
export interface HoldResult {
  provider: 'stripe' | 'mock';
  ref: string;                    // PaymentIntent id (stripe) or mock ref
  amount: number;
  currency: 'eur';
  heldAt: string;
  meta?: any;
}

export interface ReleaseArgs {
  ref: string;                    // PaymentIntent id to capture
  amount: number;                 // amount to capture (EUR units)
  currency: 'eur';
  fee?: number;                   // platform fee (EUR units) -> application_fee_amount
  meta?: Record<string, any>;     // metadata to attach to the capture
}
export interface ReleaseResult {
  provider: 'stripe' | 'mock';
  ref: string;                    // capture id / PaymentIntent id
}

export async function holdPayment(args: HoldArgs): Promise<HoldResult> {
  if (isMock(process.env.ESCROW_DRIVER)) {
    if (isProd()) {
      throw Object.assign(new Error('escrow_mock_not_allowed_in_prod'), { status: 503 });
    }
    return {
      provider: 'mock',
      ref: `pay_${Date.now()}`,
      amount: args.amount,
      currency: 'eur',
      heldAt: new Date().toISOString(),
      meta: args.meta,
    };
  }

  const intent = await stripe.paymentIntents.create({
    customer: args.customerId,
    amount: Math.round(args.amount * 100),
    currency: args.currency ?? 'eur',
    payment_method_types: ['sepa_debit'],
    capture_method: 'manual',
    metadata: args.meta,
    confirm: true,
  });

  return {
    provider: 'stripe',
    ref: intent.id,
    amount: args.amount,
    currency: 'eur',
    heldAt: new Date().toISOString(),
    meta: { status: intent.status },
  };
}

export async function releasePayment(args: ReleaseArgs): Promise<ReleaseResult> {
  if (isMock(process.env.ESCROW_DRIVER)) {
    if (isProd()) {
      throw Object.assign(new Error('escrow_mock_not_allowed_in_prod'), { status: 503 });
    }
    return { provider: 'mock', ref: `mock_release_${Date.now()}` };
  }

  const captured = await stripe.paymentIntents.capture(args.ref, {
    amount_to_capture: Math.round(args.amount * 100),
    application_fee_amount: args.fee ? Math.round(args.fee * 100) : undefined,
    metadata: args.meta,
  });

  return { provider: 'stripe', ref: captured.id };
}
