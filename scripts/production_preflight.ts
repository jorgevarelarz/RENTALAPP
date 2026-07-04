import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { loadEnv } from '../src/config/env';

const requiredFiles = [
  'legal/privacy-policy.md',
  `legal/pro-consent_${process.env.TENANT_PRO_CONSENT_VERSION || 'v1'}.md`,
  'frontend/dist/index.html',
  'institution-frontend/dist/index.html',
];

const env = loadEnv();
const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.resolve(process.cwd(), file)));

if (missingFiles.length) {
  throw new Error(`Missing production artifacts: ${missingFiles.join(', ')}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      env: env.NODE_ENV,
      port: env.PORT,
      mongoConfigured: Boolean(env.MONGO),
      corsOrigin: env.CORS_ORIGIN,
      signProvider: process.env.SIGN_PROVIDER,
      escrowDriver: process.env.ESCROW_DRIVER,
      smsProvider: process.env.SMS_PROVIDER,
    },
    null,
    2,
  ),
);
