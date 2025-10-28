import pino from 'pino';

const level = process.env.LOG_LEVEL ?? 'info';
const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level,
  enabled: !isTest || process.env.ENABLE_TEST_LOGS === 'true',
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.token', 'password', 'token'],
    censor: '***',
  },
});

export default logger;
