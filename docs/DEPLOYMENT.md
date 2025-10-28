# Deployment Runbook

This guide covers configuration, build, and operational steps required to run the RentalApp stack in staging and production.

## 1. Prerequisites

### Infrastructure
- **MongoDB 6.x** (replica set recommended for production). Connection string exposed via `MONGO_URL` or `MONGO_URI`.
- **Object storage** (optional). The app currently stores encrypted Tenant PRO uploads on the local filesystem (`storage/tenant-pro`). Mount a persistent volume if running in containers.
- **HTTPS termination** via load balancer, ingress controller, or reverse proxy (NGINX/Traefik).
- **SMTP provider** (Sendgrid, SES, etc.) for transactional emails.
- **SMS provider** (Twilio) if phone notifications are required.
- **Stripe** account (live keys) for payments.
- **DocuSign** (or alternative) when enabling real signature flows. The current provider is mocked unless `SIGN_PROVIDER=docusign` and the required credentials are set.

### Tooling
- Node.js 18 LTS or newer
- npm 9+
- Docker + Docker Compose (optional, recommended for reproducible environments)
- GitHub Actions / other CI system for build & deploy automation

## 2. Environment Variables

### Backend (`src`)
| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | yes | `development` | Environment mode (`production`, `staging`, `development`, `test`). |
| `PORT` | no | `3000` | Express listening port. |
| `MONGO_URL` / `MONGO_URI` | yes | — | MongoDB connection string. |
| `JWT_SECRET` | yes | `insecure` | Secret for signing JWTs (must be ≥16 chars in prod). |
| `CORS_ORIGIN` | yes (prod) | `http://localhost:3000,http://localhost:3001` (non prod) | Comma-separated list of allowed web origins. |
| `APP_URL` | no | — | Public URL of the backend/API (used for redirects). |
| `FRONTEND_URL` | no | — | Public URL of the SPA (used in password reset links). |
| `PASSWORD_RESET_URL` / `PASSWORD_RESET_URL_TEMPLATE` | no | — | Override for password reset link (supports `{{TOKEN}}`). |
| `TERMS_VERSION` | no | `v1` | Default version when no DB legal doc exists. |
| `PRIVACY_VERSION` | no | `v1` | Same for privacy policy. |
| `TENANT_PRO_CONSENT_VERSION` | no | `v1` | Same for Tenant PRO consent. |
| `ALLOW_UNVERIFIED` | no | — | Set to `true` only in non-production for bypassing verification. |
| `AWS_SECRETS_ID` | optional | — | ID of the AWS Secrets Manager entry to load at startup. |
| `AWS_SECRETS_REGION` | optional | `eu-north-1` | Region for Secrets Manager (defaults to `AWS_REGION`). |
| `STRIPE_SECRET_KEY` | depends | — | Live or test secret key. Required when payments enabled. |
| `STRIPE_AUTOCREATE_MODE` | no | `lazy` | `lazy` / `eager` / `off` customer provisioning. |
| `DOCUSIGN_BASE_URL` | when provider enabled | — | DocuSign REST base URL. |
| `DOCUSIGN_INTEGRATOR_KEY` | when provider enabled | — | DocuSign integration key. |
| `DOCUSIGN_USER_ID` | when provider enabled | — | DocuSign API user ID. |
| `DOCUSIGN_ACCOUNT_ID` | when provider enabled | — | DocuSign account. |
| `DOCUSIGN_PRIVATE_KEY_BASE64` | when provider enabled | — | Base64-encoded RSA private key. |
| `DOCUSIGN_WEBHOOK_SECRET` | optional | — | Secret for verifying Connect notifications. |
| `SIGN_PROVIDER` | no | — | Set to `docusign` to enforce DocuSign credentials. |
| `SMTP_HOST` | yes (prod) | — | SMTP host. |
| `SMTP_PORT` | no | `587` | SMTP port. |
| `SMTP_USER` | yes (prod) | — | SMTP username. |
| `SMTP_PASS` | yes (prod) | — | SMTP password. |
| `SMTP_FROM` | no | `noreply@rental-app.com` | Default From header. |
| `TWILIO_ACCOUNT_SID` | optional | — | Required if sending SMS. |
| `TWILIO_AUTH_TOKEN` | optional | — | Twilio token. |
| `TWILIO_PHONE_NUMBER` | optional | — | Sender phone number. |
| `SMS_PROVIDER` | optional | — | Set to `mock` to force SMS mocking. |
| `TENANT_PRO_UPLOADS_KEY` | yes | — | 32-byte (64 hex chars) key for encrypting Tenant PRO docs. |
| `DOCS_DIR` | optional | — | Not required; uploads stored in `storage/tenant-pro`. Ensure volume persistence. |

### Frontend (`frontend/`)
| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `REACT_APP_API_URL` | yes | `""` (CRA dev proxy) | Base URL for API requests. Points to backend origin. |
| `REACT_APP_STRIPE_PUBLISHABLE_KEY` / `REACT_APP_STRIPE_PK` / `VITE_STRIPE_PK` | when payments enabled | — | Stripe publishable key for client SDK. |
| `PUBLIC_URL` | no | `""` | Asset prefix (used for logos). |

Set environment variables via `.env` (local), Docker secrets, or CI/CD secret store. For container deployments, mount the files or inject as environment variables.

You can validate a given `.env` file locally with:

```bash
node scripts/checkEnv.js path/to/.env
```

## 3. Local Development

```bash
# Backend
npm install
npm run dev
# Uses .env (create from .env.example if available)

# Frontend
npm install --prefix frontend
npm start --prefix frontend
```

Helpers:
- Set `ALLOW_UNVERIFIED=true` locally to bypass verification-only flows.
- Use `npm run test:backend`, `npm run test:frontend`, `npm run test:e2e` before committing significant changes.
- The API exposes `/health` and `/metrics` (Prometheus format) for quick diagnostics.

## 4. Production Build & Release

### 4.1 Build Steps
1. **Install dependencies**
   ```bash
   npm ci
   npm ci --prefix frontend
   ```
2. **Compile backend**
   ```bash
   npm run build
   ```
   Outputs to `dist/`.
3. **Compile frontend**
   ```bash
   npm run build --prefix frontend
   ```
   Outputs to `frontend/build/`.

### 4.2 Containerization (recommended)
- Backend: multi-stage Dockerfile (Node 18 base) installing production deps, copying `dist`, running `node dist/app.js`.
- Frontend: build stage + NGINX/alpine stage serving static build.
- Provide docker-compose stack with API, frontend, MongoDB (or connect to managed cluster).

### 4.3 Runtime Checklist
- Export required environment variables for both services.
- Mount persistent storage at `storage/tenant-pro`.
- Configure reverse proxy / load balancer with HTTPS and route `/api` to backend, `/` to SPA.
- Enable gzip/ Brotli at proxy for static assets.

### 4.4 Zero-Downtime Deploy (example pipeline)
1. Run tests (`test:backend`, `test:frontend`, `test:e2e`).
2. Build Docker images tagged with commit SHA.
3. Push to registry.
4. Deploy to staging, run smoke tests.
5. Promote same images to production via rolling update (Kubernetes `Deployment`, Docker Swarm, etc.).
6. Run post-deploy smoke test (login, load contracts, create property, tenant-pro upload). Document results.

## 5. Data Seeding
- Use `npm run seed` if a seeding script is available (check `src/seed.ts`).
- Create at least:
  - Admin user (verified) for back-office operations.
  - One landlord & tenant sample with verified status for demos.
  - Demo property & contract data (optional).

## 6. Observability & Monitoring
- **Health**: `GET /health` returns `{ ok: true }` and Mongo connection state.
- **Metrics**: `GET /metrics` exposes default Prometheus metrics. Scrape with Prometheus/Grafana.
- **Logging**: uses `pino` (JSON). Ensure logs are collected (e.g., stdout to ELK/CloudWatch).
- **Alerts**: configure monitors for 4xx/5xx rate, queue of pending signatures, Stripe errors, SMTP failures (watch for `[Mock email]` logs which indicate missing SMTP configuration).

## 7. Security & Compliance
- Force HTTPS and set `CORS_ORIGIN` to exact frontend domains.
- Rotate `JWT_SECRET` and Stripe/Twilio keys periodically.
- Maintain audit of legal text versions (stored in `LegalDocument` collection) and ensure acceptance logging via `/api/legal/accept` is active.
- Backup encrypted Tenant PRO uploads along with encryption key storage (KMS or secret manager recommended).
- Set up Web Application Firewall / rate limiting on ingress beyond the built-in express-rate-limit.

## 8. Release Checklist
1. [ ] All automated tests green (`test:backend`, `test:frontend`, `test:e2e`).
2. [ ] Environment variables configured for target environment.
3. [ ] SMTP/Twilio/Stripe/DocuSign credentials validated in staging.
4. [ ] Legal texts reviewed and published via admin panel (`/admin/legal`).
5. [ ] Security review complete (JWT secret length, HTTPS, CORS locked down).
6. [ ] Backups configured for MongoDB and `storage/tenant-pro` volume.
7. [ ] Monitoring dashboards & alerting rules active.
8. [ ] Post-deploy smoke plan assigned (login, password reset, contract creation, payment intent, tenant-pro flow).
9. [ ] Support/runbook handed to operations (this document + troubleshooting guide).

## 9. Troubleshooting
- **401 on protected routes**: ensure `Authorization` header is forwarded by frontend/proxy and `JWT_SECRET` matches issued tokens.
- **Stripe 503**: set `STRIPE_SECRET_KEY`; the server errors intentionally if missing.
- **DocuSign errors**: ensure all required DocuSign env vars are present when `SIGN_PROVIDER=docusign`.
- **SMTP mock logs**: indicates config missing; verify `SMTP_HOST` & credentials.
- **Tenant PRO uploads failing**: ensure `TENANT_PRO_UPLOADS_KEY` is exactly 64 hex characters and storage path is writable.

For additional deployment automation examples, create CI templates in `.github/workflows/` or similar (not included yet).
