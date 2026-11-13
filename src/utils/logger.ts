import pino from 'pino';
import { censorLogValue, scrubDeep, scrubPii } from './redact';

const level =
  process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');

// Claves con datos personales o secretos, en el primer nivel o uno por debajo.
const REDACT_KEYS = ['to', 'email', 'phone', 'phoneNumber', 'iban', 'password', 'passwordHash', 'token', 'authorization', 'cookie'];
export const REDACT_PATHS = [
  ...REDACT_KEYS,
  ...REDACT_KEYS.map((key) => `*.${key}`),
  'req.headers.authorization',
  'req.headers.cookie',
];

export const loggerOptions: pino.LoggerOptions = {
  level,
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: REDACT_PATHS, censor: censorLogValue },
  serializers: {
    // Los errores de SMTP, Twilio o Mongo (E11000) suelen llevar el correo o el teléfono en el mensaje.
    err: (err: Error) => scrubDeep(pino.stdSerializers.err(err)),
  },
  hooks: {
    logMethod(args, method) {
      method.apply(
        this,
        args.map((arg) => (typeof arg === 'string' ? scrubPii(arg) : arg)) as Parameters<typeof method>,
      );
    },
  },
};

export const logger = pino(loggerOptions);

export default logger;
