import 'dotenv/config';
import logger from './utils/logger';
import { loadAwsSecrets } from './config/awsSecrets';

async function bootstrap() {
  const secretId = process.env.AWS_SECRETS_ID;

  if (secretId && process.env.NODE_ENV !== 'development') {
    await loadAwsSecrets({ secretId });
  }

  await import('./app');
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, '[server] Failed to bootstrap application');
  process.exit(1);
});
