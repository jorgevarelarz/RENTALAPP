#!/usr/bin/env node
/**
 * Simple environment validator.
 * Usage: node scripts/checkEnv.js [path/to/.env]
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const required = [
  'NODE_ENV',
  'MONGO_URL',
  'JWT_SECRET',
  'CORS_ORIGIN',
  'APP_URL',
  'FRONTEND_URL',
  'TENANT_PRO_UPLOADS_KEY',
];

const recommended = [
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'DOCUSIGN_INTEGRATOR_KEY',
  'DOCUSIGN_PRIVATE_KEY_BASE64',
  'DOCUSIGN_WEBHOOK_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'AWS_SECRETS_ID',
  'AWS_SECRETS_REGION',
];

function loadEnv(file) {
  const envPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(envPath)) {
    console.error(`\n[check-env] File not found: ${envPath}`);
    process.exit(1);
  }
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error(`\n[check-env] Failed to parse ${envPath}:`, result.error.message);
    process.exit(1);
  }
  return result.parsed || {};
}

function formatList(arr) {
  return arr.map(key => `  - ${key}`).join('\n');
}

(function main() {
  const file = process.argv[2] || '.env';
  const env = loadEnv(file);

  const missingRequired = required.filter(key => !env[key] || env[key].trim() === '' || env[key].includes('<'));
  const missingRecommended = recommended.filter(key => !env[key] || env[key].trim() === '' || env[key].includes('<'));

  console.log(`\n[check-env] Validating ${file}`);
  console.log(`Loaded ${Object.keys(env).length} variables.`);

  if (missingRequired.length) {
    console.error(`\n❌ Missing required variables: \n${formatList(missingRequired)}`);
  } else {
    console.log('\n✅ Required variables present.');
  }

  if (missingRecommended.length) {
    console.warn(`\n⚠️  Recommended variables missing/placeholder: \n${formatList(missingRecommended)}`);
  } else {
    console.log('\n✅ Recommended variables present.');
  }

  if (missingRequired.length) {
    process.exit(1);
  }
})();
