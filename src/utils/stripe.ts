import Stripe from 'stripe';
import logger from './logger';

const API_VERSION: Stripe.LatestApiVersion = '2022-11-15';
let cachedClient: Stripe | null = null;

function buildStripeClient(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    const err = Object.assign(new Error('stripe_not_configured'), { status: 503 });
    throw err;
  }
  if (secret.length < 16) {
    const err = Object.assign(new Error('stripe_secret_too_short'), { status: 503 });
    throw err;
  }
  logger.info({ apiVersion: API_VERSION }, '[stripe] Cliente inicializado');
  return new Stripe(secret, { apiVersion: API_VERSION });
}

/**
 * Obtiene una instancia singleton de Stripe validando que exista la clave.
 * Lanza un error con status 503 si Stripe no está configurado.
 */
export function getStripeClient(): Stripe {
  if (!cachedClient) {
    cachedClient = buildStripeClient();
  }
  return cachedClient;
}

/**
 * Indica si Stripe está configurado correctamente (clave presente y con longitud mínima).
 */
export function isStripeConfigured(): boolean {
  const secret = process.env.STRIPE_SECRET_KEY;
  return typeof secret === 'string' && secret.length >= 16;
}

/**
 * Permite resetear el cliente en tests para aislar escenarios.
 */
export function __resetStripeClientForTests() {
  if (process.env.NODE_ENV === 'test') {
    cachedClient = null;
  }
}
