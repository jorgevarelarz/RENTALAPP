import winston from 'winston';

const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'jwt',
  'cardNumber',
  'cvv',
  'ssn',
]);

function redactSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => redactSensitive(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    out[key] = SENSITIVE_FIELDS.has(key.toLowerCase()) ? '[REDACTED]' : redactSensitive(value, depth + 1);
  }
  return out;
}

const isProd = process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProd ? 'http' : 'debug'),
  format: isProd
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      )
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
  transports: [new winston.transports.Console()],
});

export function logError(message: string, meta?: Record<string, unknown>) {
  logger.error(message, meta ? (redactSensitive(meta) as object) : undefined);
}

export function logWarn(message: string, meta?: Record<string, unknown>) {
  logger.warn(message, meta ? (redactSensitive(meta) as object) : undefined);
}

export function logInfo(message: string, meta?: Record<string, unknown>) {
  logger.info(message, meta ? (redactSensitive(meta) as object) : undefined);
}

export function logDebug(message: string, meta?: Record<string, unknown>) {
  logger.debug(message, meta ? (redactSensitive(meta) as object) : undefined);
}
