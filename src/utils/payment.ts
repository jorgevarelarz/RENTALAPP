import crypto from 'crypto';
import type Stripe from 'stripe';
import { isProd, isMock } from '../config/flags';
import { getStripeClient, isStripeConfigured } from './stripe';

function ensureStripe(): Stripe {
  if (!isStripeConfigured()) {
    const err = Object.assign(new Error('payments_unavailable'), { status: 503 });
    throw err;
  }
  return getStripeClient();
}

function getIbanKey(): Buffer {
  const keyHex = process.env.IBAN_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error('IBAN_ENCRYPTION_KEY no está definido');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error('IBAN_ENCRYPTION_KEY debe tener 64 caracteres hex (32 bytes)');
  }
  return Buffer.from(keyHex, 'hex');
}

const IBAN_AUTH_TAG_LENGTH = 16;
const IBAN_IV_LENGTH = 12;
const LEGACY_IBAN_IV_LENGTH = 16;

/**
 * Encripta un IBAN usando AES-256-GCM. Devuelve un string con el formato
 * IVHEX:PAYLOADHEX:TAGHEX para facilitar su almacenamiento.
 */
export const encryptIBAN = (iban: string): string => {
  const key = getIbanKey();
  const iv = crypto.randomBytes(IBAN_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
    authTagLength: IBAN_AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([cipher.update(iban, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
};

/**
 * Desencripta un IBAN previamente cifrado con encryptIBAN. Verifica el tag de
 * autenticación para detectar manipulaciones.
 */
export const decryptIBAN = (encryptedIban: string): string => {
  const parts = encryptedIban.split(':');
  if (parts.length !== 2 && parts.length !== 3) {
    throw new Error('formato_iban_invalido');
  }
  const key = getIbanKey();
  if (parts.length === 2) {
    const [ivHex, payloadHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const payload = Buffer.from(payloadHex, 'hex');
    if (iv.length !== LEGACY_IBAN_IV_LENGTH) {
      throw new Error('vector_inicializacion_invalido');
    }
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
    return decrypted.toString('utf8');
  }
  const [ivHex, payloadHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const payload = Buffer.from(payloadHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  if (iv.length !== IBAN_IV_LENGTH) {
    throw new Error('vector_inicializacion_invalido');
  }
  if (tag.length !== IBAN_AUTH_TAG_LENGTH) {
    throw new Error('tag_autenticacion_invalido');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, {
    authTagLength: IBAN_AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString('utf8');
};

/**
 * Crea un cliente en Stripe y adjunta un mandato SEPA usando el IBAN
 * proporcionado. Devuelve el ID del cliente generado.
 */
export const createCustomerAndMandate = async (
  name: string,
  email: string,
  iban: string,
): Promise<string> => {
  const stripe = ensureStripe();
  const customer = await stripe.customers.create({ name, email });
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
 * Crea un PaymentIntent para cobrar renta o depósito a un cliente Stripe.
 */
export const createPaymentIntent = async (
  customerId: string,
  amount: number,
  currency = 'eur',
) => {
  const stripe = ensureStripe();
  return stripe.paymentIntents.create({
    customer: customerId,
    amount: Math.round(amount * 100),
    currency,
    payment_method_types: ['sepa_debit'],
    confirm: true,
  });
};

export interface HoldArgs {
  customerId: string;
  amount: number;
  currency?: 'eur';
  meta?: any;
}
export interface HoldResult {
  provider: 'stripe' | 'mock';
  ref: string;
  amount: number;
  currency: 'eur';
  heldAt: string;
  meta?: any;
}

export interface ReleaseArgs {
  ref: string;
  amount: number;
  currency: 'eur';
  fee?: number;
  meta?: Record<string, any>;
}
export interface ReleaseResult {
  provider: 'stripe' | 'mock';
  ref: string;
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

  const stripe = ensureStripe();
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

  const stripe = ensureStripe();
  const captured = await stripe.paymentIntents.capture(args.ref, {
    amount_to_capture: Math.round(args.amount * 100),
    application_fee_amount: args.fee ? Math.round(args.fee * 100) : undefined,
    metadata: args.meta,
  });

  return { provider: 'stripe', ref: captured.id };
}
