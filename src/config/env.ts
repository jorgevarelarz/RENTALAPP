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
    if (!e.CORS_ORIGIN) {
      console.warn('[env] CORS_ORIGIN no definido en producción — se recomienda configurarlo');
    }
  }

  return { ...e, MONGO } as Env;
}
