# Production Environment Variables

Required and recommended environment variables for a production deployment of RentalApp.

Variables marked **REQUIRED** will cause the server to refuse to start if absent or invalid. Variables marked **RECOMMENDED** do not crash the server but represent a security or functional risk if omitted.

---

## Core

| Variable | Required | Description |
| --- | --- | --- |
| `NODE_ENV` | REQUIRED | Must be `production`. Controls guards, mock bypasses, and strict validation. |
| `PORT` | optional | HTTP port. Default `3000`. Usually overridden by the container orchestrator. |
| `MONGO_URL` or `MONGO_URI` | REQUIRED | MongoDB connection string including database name. |
| `JWT_SECRET` | REQUIRED | Minimum 16 chars. Used to sign all user sessions. Generate with `openssl rand -hex 32`. |
| `CORS_ORIGIN` | RECOMMENDED | Allowed frontend origin (e.g. `https://app.rentalapp.es`). If absent, CORS falls back to permissive defaults — a warning is logged. |
| `APP_URL` | RECOMMENDED | Public base URL of the API (e.g. `https://api.rentalapp.es`). Used in Stripe return URLs and email links. |

---

## Frontend (Vite)

These variables are public and bundled into the browser build. Do not put secrets here.

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | RECOMMENDED | Public API base URL used by the main frontend. Leave empty only when the frontend is served by the API origin. |
| `VITE_STRIPE_KEY` | REQUIRED (payments UI) | Stripe publishable key (`pk_live_...`). This is safe for the browser; never use `STRIPE_SECRET_KEY` here. |
| `VITE_RENTAL_PUBLIC_DEMO_MODE` | optional | `true` enables RentalPublic demo UI behavior. Keep `false` in production. |

Legacy `REACT_APP_*` names are still accepted by the frontend compatibility layer, but new deployments should use `VITE_*`.

---

## Payments — Stripe

| Variable | Required | Description |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | REQUIRED | Live Stripe secret key (`sk_live_…`). |
| `STRIPE_WEBHOOK_SECRET` | REQUIRED | Webhook signing secret from the Stripe dashboard. Used for HMAC verification on `/api/stripe/webhook`. |
| `STRIPE_IDENTITY_WEBHOOK_SECRET` | REQUIRED | Webhook signing secret for Stripe Identity events on `/api/kyc/webhook`. Without this, webhook signature verification is skipped and the endpoint trusts any caller. |
| `SERVICE_FEE_PERCENT` | optional | Stripe service fee applied on deposit payments. Default `0.07` (7%). |
| `PAYMENT_METHODS` | optional | Comma-separated Stripe payment methods. Default `sepa_debit,card,bizum`. |
| `ESCROW_DRIVER` | optional | `mock` or `real`. Default `mock`. Set to `real` to use actual Stripe escrow flows. |

---

## Commissions

| Variable | optional | Description |
| --- | --- | --- |
| `PLATFORM_RENT_FEE_PCT` | optional | Platform cut on rent payments (%). Default `5`. |
| `PLATFORM_MIN_RENT_FEE_CENTS` | optional | Minimum platform fee in cents. Default `0`. |
| `PLATFORM_SIGN_FEE_PCT` | optional | Platform fee on contract signing (%). Default `2`. |
| `CONTRACT_SIGN_FEE_MODE` | optional | `deferred` or other mode. Default `deferred`. |
| `AGENCY_RENT_FEE_SHARE_PCT` | optional | Percentage of platform rent fee shared with agencies via Stripe Connect. Default `20`. |

---

## Electronic Signature

| Variable | Required | Description |
| --- | --- | --- |
| `SIGN_PROVIDER` | REQUIRED | `mock`, `signaturit`, or `docusign`. Must not be `mock` in production. |
| `SIGN_EMBEDDED` | optional | `true` for embedded signing views. Default `false`. |
| **Signaturit** | | |
| `SIGNATURE_API_TOKEN` | REQUIRED (if provider=signaturit) | Signaturit API token. |
| `SIGNATURE_WEBHOOK_SECRET` | REQUIRED (if provider=signaturit) | HMAC secret for Signaturit webhook callbacks. |
| `SIGNATURIT_TOKEN` | REQUIRED (if provider=signaturit) | Token for widget URL generation. |
| `SIGNATURIT_ENV` | optional | `sandbox` or `production`. Default `sandbox`. Set to `production` for live. |
| **DocuSign** | | |
| `DOCUSIGN_BASE_URL` | REQUIRED (if provider=docusign) | `https://www.docusign.net` for live. |
| `DOCUSIGN_INTEGRATOR_KEY` | REQUIRED (if provider=docusign) | OAuth client ID. |
| `DOCUSIGN_USER_ID` | REQUIRED (if provider=docusign) | DocuSign user GUID. |
| `DOCUSIGN_ACCOUNT_ID` | REQUIRED (if provider=docusign) | DocuSign account ID. |
| `DOCUSIGN_PRIVATE_KEY_BASE64` | REQUIRED (if provider=docusign) | RSA private key (PEM) encoded as base64 for JWT auth. |
| `DOCUSIGN_WEBHOOK_SECRET` | REQUIRED (if provider=docusign) | HMAC secret for DocuSign Connect webhooks (X-DocuSign-Signature-1). |

---

## Email (SMTP)

| Variable | Required | Description |
| --- | --- | --- |
| `SMTP_HOST` | RECOMMENDED | SMTP server hostname. Without this, email sending silently fails. |
| `SMTP_PORT` | RECOMMENDED | SMTP port (typically `587` for TLS, `465` for SSL). |
| `SMTP_USER` | RECOMMENDED | SMTP authentication username. |
| `SMTP_PASS` | RECOMMENDED | SMTP authentication password. |
| `SMTP_FROM` | optional | Sender address. Default `no-reply@localhost`. |

---

## SMS — Twilio

| Variable | Required | Description |
| --- | --- | --- |
| `SMS_PROVIDER` | REQUIRED | `twilio` in production when SMS sending is enabled. Use `disabled` until Twilio is configured. `mock` is not allowed in production. |
| `TWILIO_ACCOUNT_SID` | REQUIRED (if provider=twilio) | Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | REQUIRED (if provider=twilio) | Twilio auth token. |
| `TWILIO_PHONE_NUMBER` | REQUIRED (if provider=twilio) | Twilio phone number (E.164 format). |

---

## Security & Encryption

| Variable | Required | Description |
| --- | --- | --- |
| `IBAN_ENCRYPTION_KEY` | REQUIRED | 32-byte hex string (64 chars). Used to encrypt stored IBANs. Generate with `openssl rand -hex 32`. Changing this in production invalidates all stored IBANs. |
| `INSTITUTION_CASEID_SALT` | REQUIRED | Minimum 16 chars. Salt for institution case ID hashing. |
| `BANK_ACCOUNT` | optional | Default bank IBAN displayed in contracts. |

---

## TenantPRO (Document Storage)

TenantPRO documents are stored encrypted on the app storage volume.

| Variable | Required | Description |
| --- | --- | --- |
| `TENANT_PRO_UPLOADS_KEY` | REQUIRED | 32-byte hex encryption key for TenantPRO document uploads. Generate with `openssl rand -hex 32`. |
| `TENANT_PRO_DOCS_TTL_DAYS` | optional | Days before documents are auto-deleted. Default `365`. |

---

## Redis

Used for admin rate limiting. The server starts without Redis but rate limiting on admin routes will be degraded.

| Variable | Required | Description |
| --- | --- | --- |
| `REDIS_URL` | RECOMMENDED | Full Redis connection URL (e.g. `redis://user:pass@host:6379`). Takes precedence over host/port. |
| `REDIS_HOST` | RECOMMENDED | Redis hostname (used if `REDIS_URL` is absent). |
| `REDIS_PORT` | optional | Redis port. Default `6379`. |

---

## Compliance — RentalPublic

| Variable | Required | Description |
| --- | --- | --- |
| `ENFORCE_TENSIONED_RULES` | optional | `true` to enforce rental price compliance for tensioned areas. Default off. |
| `RENTAL_PUBLIC_DEMO_MODE` | optional | `true` enables demo data for the compliance dashboard. Do not set in production. |

---

## System Maintenance

| Variable | Required | Description |
| --- | --- | --- |
| `SYSTEM_EVENTS_RETENTION_DAYS` | optional | Days to retain system events before cleanup job removes them. Default `180`. |

---

## Variables that must NOT be set in production

| Variable | Reason |
| --- | --- |
| `ALLOW_UNVERIFIED=true` | Bypasses KYC verification checks entirely. |
| `ALLOW_TEST_AUTH=true` | Allows `x-user-id` / `x-user-role` header auth bypass — any caller can impersonate any user. |
| `ALLOW_TENANT_PRO_IN_DEV=true` | Relaxes TenantPRO flow restrictions. |
| `RENTAL_PUBLIC_DEMO_MODE=true` | Injects demo data into compliance responses. |

---

## Quick generation commands

```bash
# JWT_SECRET
openssl rand -hex 32

# IBAN_ENCRYPTION_KEY
openssl rand -hex 32

# INSTITUTION_CASEID_SALT
openssl rand -hex 16
```
