# Environment Validation Reports

Use `node scripts/checkEnv.js <file>` to verify required configuration. Below are the current results.

## .env (local)
```
❌ Missing required variables: 
  - NODE_ENV
  - FRONTEND_URL

⚠️  Recommended variables missing/placeholder: 
  - SMTP_HOST
  - SMTP_USER
  - SMTP_PASS
  - DOCUSIGN_INTEGRATOR_KEY
  - DOCUSIGN_PRIVATE_KEY_BASE64
  - DOCUSIGN_WEBHOOK_SECRET
  - TWILIO_ACCOUNT_SID
  - TWILIO_AUTH_TOKEN
  - TWILIO_PHONE_NUMBER
  - AWS_SECRETS_ID
  - AWS_SECRETS_REGION
Loaded 33 variables.
```

## deployment/env/staging.env.template
```
❌ Missing required variables: 
  - MONGO_URL
  - JWT_SECRET
  - TENANT_PRO_UPLOADS_KEY

⚠️  Recommended variables missing/placeholder: 
  - SMTP_USER
  - SMTP_PASS
  - DOCUSIGN_INTEGRATOR_KEY
  - DOCUSIGN_PRIVATE_KEY_BASE64
  - DOCUSIGN_WEBHOOK_SECRET
  - TWILIO_ACCOUNT_SID
  - TWILIO_AUTH_TOKEN
Loaded 39 variables.
```

## deployment/env/production.env.template
```
❌ Missing required variables: 
  - MONGO_URL
  - JWT_SECRET
  - TENANT_PRO_UPLOADS_KEY

⚠️  Recommended variables missing/placeholder: 
  - SMTP_HOST
  - SMTP_USER
  - SMTP_PASS
  - DOCUSIGN_INTEGRATOR_KEY
  - DOCUSIGN_PRIVATE_KEY_BASE64
  - DOCUSIGN_WEBHOOK_SECRET
  - TWILIO_ACCOUNT_SID
  - TWILIO_AUTH_TOKEN
Loaded 39 variables.
```

Update these files in your secret store/CI pipeline. Re-run the script until all required fields are populated.
