# Sprint 01 Execution Log

## Done In This Package

- Added internal funnel events for visit, register, login, search, application, contract and payment.
- Reused `SystemEvent` instead of adding a second analytics store.
- Expanded production smoke checks with public API, login when credentials are provided, and more sensitive-path 404 checks.
- Added Valeris Mongo backup script and restore drill documentation.

## Blocked Or Deferred

- Stripe live key rotation: blocked until a new live key is created in Stripe Dashboard. Do not reuse keys pasted in chat.
- SMTP production: blocked until real SMTP credentials are available.
- External uptime monitor: deferred until provider/account is chosen. `npm run smoke:production` is the local monitor fallback.
- Twilio/SMS: intentionally deferred; production keeps `SMS_PROVIDER=disabled`.

## Checks

```bash
npm run build
npm run test:backend -- --runInBand --forceExit tests/unit/funnelEvents.test.ts
npm run roadmap:check
```

Run after deploy:

```bash
npm run smoke:production
```
