import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import logger from '../utils/logger';

let secretsLoaded = false;

export async function loadAwsSecrets(options: {
  secretId: string;
  region?: string;
  force?: boolean;
}): Promise<void> {
  const { secretId, region = process.env.AWS_SECRETS_REGION || process.env.AWS_REGION || 'eu-north-1', force } = options;

  if (!secretId) {
    logger.warn('[aws-secrets] Secret ID not provided; skipping secret loading');
    return;
  }

  if (secretsLoaded && !force) {
    return;
  }

  const client = new SecretsManagerClient({ region });

  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    const secret = response.SecretString ?? (response.SecretBinary ? Buffer.from(response.SecretBinary).toString('utf-8') : null);

    if (!secret) {
      logger.warn({ secretId }, '[aws-secrets] Secret has no string content');
      return;
    }

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(secret);
    } catch (error) {
      logger.error({ error, secretId }, '[aws-secrets] Failed to parse SecretString as JSON');
      throw error;
    }

    Object.assign(process.env, parsed);
    secretsLoaded = true;
    logger.info({ secretId, region }, '[aws-secrets] Secret values loaded into process.env');
  } catch (error) {
    logger.error({ error, secretId }, '[aws-secrets] Unable to retrieve secret');
    throw error;
  }
}

export function hasLoadedAwsSecrets() {
  return secretsLoaded;
}
