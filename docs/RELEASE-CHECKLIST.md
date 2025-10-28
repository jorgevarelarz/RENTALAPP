# Release Checklist

> Use this checklist to track readiness for the RentalApp production launch. Mark each item once completed. Owners and target dates should be filled in per release cycle.

## 1. Product & QA
- [ ] Feature freeze declared; scope approved by Product.
- [ ] Full automated test suite passed (`npm run test:backend`, `npm run test:frontend`, `npm run test:e2e`).
- [ ] Manual smoke test on staging covering:
  - [ ] Onboarding (register + login + legal consent).
  - [ ] Password reset email flow.
  - [ ] Tenant PRO consent + document upload + admin approval.
  - [ ] Contract creation, signature initiation, and PDF download.
  - [ ] Payment intent / deposit flow.
  - [ ] Notifications (email/SMS) hitting real providers.
- [ ] Regression/UX walkthrough on latest browsers (Chrome, Firefox, Safari, Edge) + mobile viewport.

## 2. Configuration & Access
- [ ] `.env` / secret store populated for target environment (see `docs/DEPLOYMENT.md`).
- [ ] Stripe keys (test vs live) verified; webhook endpoints configured.
- [ ] SMTP credentials validated (deliverability test email sent).
- [ ] Twilio (or SMS provider) credentials validated.
- [ ] DocuSign credentials (if live signatures enabled) validated with sandbox envelope (or feature toggled off).
- [ ] Admin accounts created with strong passwords + MFA (where available).
- [ ] RBAC roles reviewed; default users seeded.

## 3. Infrastructure
- [ ] MongoDB cluster provisioned with backups + monitoring.
- [ ] Persistent storage for `storage/tenant-pro` mounted (check encryption key management).
- [ ] Backend/API deployed to staging with HTTPS behind load balancer / ingress.
- [ ] Frontend static assets deployed (NGINX/CDN) pointing to correct API base URL.
- [ ] Logging pipeline configured (stdout → ELK/CloudWatch/etc.).
- [ ] Metrics endpoint scraped by Prometheus / equivalent.
- [ ] Alerting rules configured (availability, latency, Stripe/SMTP errors, queue backlog).

## 4. Security & Compliance
- [ ] JWT secret rotated and stored securely (16+ chars).
- [ ] CORS domains restricted to production URLs.
- [ ] HTTPS enforced end-to-end.
- [ ] Legal copy (terms, privacy, Tenant PRO consent) reviewed by Legal and published via admin panel.
- [ ] Data retention & privacy policy published on marketing site.
- [ ] Penetration test / vulnerability scan completed or scheduled.
- [ ] Tenant PRO document retention policies configured (TTL job).

## 5. Go-Live Preparation
- [ ] Release notes drafted (features, fixes, known issues).
- [ ] Support / ops handover (on-call schedule, escalation paths, FAQ).
- [ ] Runbook shared with stakeholders (link to `docs/DEPLOYMENT.md` & this checklist).
- [ ] Final GO/NO-GO meeting scheduled with cross-functional stakeholders.

## 6. Launch Day
- [ ] Trigger CI/CD pipeline with tagged release.
- [ ] Deploy to production (backend + frontend).
- [ ] Run post-deploy smoke test (same scenarios as staging).
- [ ] Monitor dashboards for first 2 hours (traffic, errors, performance, payments).
- [ ] Announce release status to stakeholders (Slack/email).

## 7. Post-Launch
- [ ] Verify analytics/telemetry events captured correctly.
- [ ] Confirm no critical errors in logs for 24h.
- [ ] Conduct retrospective (capture lessons learned, update runbook/checklist).
- [ ] Close release ticket with summary & metrics.

---

**Notes**
- Keep this checklist in version control; update as processes evolve.
- For each checkpoint assign owner, due date, and status (e.g., via table or issue tracker).
- Complement with incident response plan and SLA/SLO definitions.
