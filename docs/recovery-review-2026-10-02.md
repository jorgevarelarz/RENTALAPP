# Recovery review — 2 October 2026

This branch recovers a reviewed subset of the old `RentalAPP2.3` working tree onto `main` (`726bf6f`). It does **not** publish the entire old snapshot or merge the WIP commit `aa096ac`.

## Recovered

- Contract status normalization accepts legacy `signing`/`generated` records, preserves closed states and rejects unknown transitions. Initial creation remains `draft` as in main.
- Contract guidance, consistent status badges, property publication requirements and photo upload error feedback.
- Partial signatures are stored as canonical `pending_signature` in every writer (signContractAction, Signaturit, DocuSign, co-tenant); readers (landlord stats, active-contract widget, contract detail) accept legacy `signing` too.
- Institution case-id salt no longer falls back to `insecure-institution-salt` (throws in production if neither `INSTITUTION_CASEID_SALT` nor `JWT_SECRET` is set).
- Request logging is silenced under `NODE_ENV=test`.
- Publishing is only blocked by the 3-photo minimum, the same rule the backend enforces; price/address are shown as advice.
- Admin audit streaming uses the shared JWT secret resolver instead of the `insecure` fallback.
- Main's OAuth, shared API client, Stripe configuration, rent suggestions, contract timeline, agency referrals, protected routes and current dependencies are retained.

## Withheld after review

- The alternate server/contracts/institution/Tenant PRO module split predates main's controller extraction and route/security fixes. A mechanical replacement would remove newer behavior; any remaining functional differences need a separate port and security review.
- Session-storage migration changes only some consumers and leaves other authentication/OAuth readers on local storage.
- PolicyModal calls an effect after a conditional return, and its document UI depends on server/legal changes not recovered here.
- Tenant PRO document UI depends on withheld backend download/export changes; model metadata alone would be incomplete.
- Upload and PDF storage moves require a coordinated reader/static-serving migration and compatibility verification for existing documents.
- ApplicantsModal adds a new hard requirement to wait for the visit date before creating a contract; this changes business behavior and needs confirmation.
- Old environment/CI/package/lockfile/README changes predate the current Vite setup, production commands and security dependency updates. Current main versions retained.
- Legal documents use old dates and rentalapp.com contacts that differ from current public pages. They need owner validation before publication.
- `robert-client-portal` is an unrelated WordPress plugin and excluded entirely.
- Browser-only product events (`window.__rentalappEvents`) were dropped: nothing consumed them and the backend already records contract/payment funnel events in `SystemEvent`.

The original working tree remains untouched. The full RentalApp snapshot (excluding the unrelated plugin) is backed up locally at `/Users/jorge/audits/rentalapp-publish-2026-10-02/local-changes.patch` with an alternate Git index and snapshot tree.

## Original patch files not recovered

- `.env.example`
- `.github/workflows/ci.yml`
- `README.md`
- `eslint.config.js`
- `frontend/.env.example`
- `frontend/README.md`
- `frontend/eslint.config.js`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/__mocks__/axios.ts`
- `frontend/src/__tests__/rbac.ui.test.tsx`
- `frontend/src/api/client.ts`
- `frontend/src/components/AppLayout.tsx`
- `frontend/src/components/ApplicantsModal.tsx`
- `frontend/src/components/Layout.tsx`
- `frontend/src/components/NavBar.tsx`
- `frontend/src/components/PolicyModal.tsx`
- `frontend/src/components/TenantProPanel.tsx`
- `frontend/src/components/__tests__/PolicyModal.test.tsx`
- `frontend/src/hooks/usePolicyAcceptance.ts`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Earnings.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/__tests__/ContractDetail.test.tsx`
- `frontend/src/pages/admin/ComplianceDashboard.tsx`
- `frontend/src/reportWebVitals.ts`
- `frontend/src/services/auth.ts`
- `frontend/src/services/tenantPro.ts`
- `frontend/src/setupTests.ts`
- `frontend/src/utils/media.ts`
- `frontend/src/utils/sessionAuth.ts`
- `frontend/vite.config.ts`
- `institution-frontend/package.json`
- `institution-frontend/src/App.tsx`
- `jest.afterEnv.ts`
- `jest.config.js`
- `legal/data-processing.md`
- `legal/privacy-policy.md`
- `legal/terms-of-service.md`
- `package-lock.json`
- `package.json`
- `scripts/e2e.ts`
- `src/app.ts`
- `src/config/env.ts`
- `src/controllers/contract.controller.ts`
- `src/models/user.model.ts`
- `src/modules/contracts/core.controller.ts`
- `src/modules/contracts/core.service.ts`
- `src/modules/contracts/http.ts`
- `src/modules/contracts/notifications.controller.ts`
- `src/modules/contracts/parties.controller.ts`
- `src/modules/contracts/payments.controller.ts`
- `src/modules/contracts/payments.routes.ts`
- `src/modules/contracts/read.controller.ts`
- `src/modules/contracts/read.service.ts`
- `src/modules/contracts/reports.controller.ts`
- `src/modules/contracts/signature.controller.ts`
- `src/modules/contracts/signature.routes.ts`
- `src/modules/institution/controller.ts`
- `src/routes/institution.routes.ts`
- `src/controllers/institution.controller.ts` (only the salt fix was ported)
- `src/modules/tenant-pro/admin.routes.ts`
- `src/modules/tenant-pro/http.ts`
- `src/modules/tenant-pro/self.routes.ts`
- `src/modules/tenant-pro/service.ts`
- `src/modules/tenant-pro/user.routes.ts`
- `src/routes/admin.tenantPro.routes.ts`
- `src/routes/contract.payments.routes.ts`
- `src/routes/contract.routes.ts`
- `src/routes/me.routes.ts`
- `src/routes/tenantPro.me.ts`
- `src/routes/tenantPro.routes.ts`
- `src/routes/upload.routes.ts`
- `src/server/registerApiRoutes.ts`
- `src/server/registerAppMiddleware.ts`
- `src/server/registerBackgroundJobs.ts`
- `src/server/startServer.ts`
- `src/server/systemRoutes.ts`
- `src/utils/getJwtSecret.ts`
- `src/utils/pdfGenerator.ts`
