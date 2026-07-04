import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  MONGO_URL: z.string().optional(),
  MONGO_URI: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  CORS_ORIGIN: z.string().optional(),
  TENANT_PRO_CONSENT_VERSION: z.string().default('v1'),
  ALLOW_UNVERIFIED: z.string().optional(),
  ENFORCE_TENSIONED_RULES: z.string().optional(),
  RENTAL_PUBLIC_DEMO_MODE: z.string().optional(),
  INSTITUTION_CASEID_SALT: z.string().optional(),
  SYSTEM_EVENTS_RETENTION_DAYS: z.string().optional(),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema> & { MONGO: string };

function requireProductionEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} requerido en producción`);
  return value;
}

function requireHex(name: string, length: number) {
  const value = requireProductionEnv(name);
  if (!new RegExp(`^[a-fA-F0-9]{${length}}$`).test(value)) {
    throw new Error(`${name} debe ser un hex de ${length} chars en producción`);
  }
  return value;
}

export function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // No lanzamos en test/desarrollo por flexibilidad, pero mostramos detalle
    console.warn('[env] Variables no válidas:', parsed.error.flatten());
  }
  const e = (parsed.success ? parsed.data : (process.env as any)) as z.infer<typeof EnvSchema>;

  const MONGO = e.MONGO_URL || e.MONGO_URI || '';

  // Validaciones estrictas en producción
  if (e.NODE_ENV === 'production') {
    if (!MONGO) throw new Error('MONGO_URL/MONGO_URI requerido en producción');
    if (!e.JWT_SECRET || e.JWT_SECRET.length < 16) {
      throw new Error('JWT_SECRET fuerte requerido en producción');
    }
    if (!e.INSTITUTION_CASEID_SALT || e.INSTITUTION_CASEID_SALT.length < 16) {
      throw new Error('INSTITUTION_CASEID_SALT requerido en producción');
    }
    requireHex('IBAN_ENCRYPTION_KEY', 64);
    requireHex('TENANT_PRO_UPLOADS_KEY', 64);
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET requerido en producción');
    }
    requireProductionEnv('STRIPE_SECRET_KEY');
    if (!process.env.STRIPE_IDENTITY_WEBHOOK_SECRET) {
      throw new Error('STRIPE_IDENTITY_WEBHOOK_SECRET requerido en producción');
    }
    if (!e.CORS_ORIGIN) {
      console.warn('[env] CORS_ORIGIN no definido en producción — se recomienda configurarlo');
    }
    // Flags peligrosos que no deben estar activos en producción
    if (process.env.ALLOW_TEST_AUTH === 'true') {
      throw new Error('ALLOW_TEST_AUTH=true no está permitido en producción');
    }
    if (process.env.ALLOW_UNVERIFIED === 'true') {
      throw new Error('ALLOW_UNVERIFIED=true no está permitido en producción');
    }
    if ((process.env.ESCROW_DRIVER || 'mock') === 'mock') {
      throw new Error('ESCROW_DRIVER=mock no está permitido en producción');
    }
    if ((process.env.SIGN_PROVIDER || 'mock') === 'mock') {
      throw new Error('SIGN_PROVIDER=mock no está permitido en producción');
    }
    const smsProvider = (process.env.SMS_PROVIDER || 'mock').toLowerCase();
    if (smsProvider === 'mock') {
      throw new Error('SMS_PROVIDER=mock no está permitido en producción');
    }

    const signProvider = (process.env.SIGN_PROVIDER || '').toLowerCase();
    if (signProvider === 'docusign') {
      [
        'DOCUSIGN_BASE_URL',
        'DOCUSIGN_INTEGRATOR_KEY',
        'DOCUSIGN_USER_ID',
        'DOCUSIGN_ACCOUNT_ID',
        'DOCUSIGN_PRIVATE_KEY_BASE64',
        'DOCUSIGN_WEBHOOK_SECRET',
      ].forEach(requireProductionEnv);
    }
    if (signProvider === 'signaturit') {
      ['SIGNATURE_API_TOKEN', 'SIGNATURE_WEBHOOK_SECRET', 'SIGNATURIT_TOKEN'].forEach(requireProductionEnv);
    }
    if (smsProvider === 'twilio') {
      ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'].forEach(requireProductionEnv);
    }
  }

  return { ...e, MONGO } as Env;
}
