# RentalApp Agent Notes

This file is the shared working guide for AI coding agents working on this repository.
Claude Code, Codex, and any other coding assistant should read this before making changes.

## Canonical Project Memory

The live project memory is in:

- `docs/PROJECT_MEMORY.md`

Update that file whenever you make a meaningful change, discover an important risk, or decide a technical direction.

## Current Canonical Checkout

Use this repository as the active version:

- `/Users/jorge/Desktop/02 RentalApp/rentalapp 2.3`
- Remote: `https://github.com/jorgevarelarz/RENTALAPP.git`
- Main branch: `main`
- Current synchronized GitHub commit before local version bump: `474eb73`
- Local version bump pending: root package version `2.3.0`

Other local folders named `RentalApp2.3`, `rental-app3`, `.rentalapp`, etc. are older/reference copies unless the user explicitly says otherwise.

## Collaboration Rules

- Do not overwrite user or other-agent changes. Check `git status` before editing.
- Prefer small, reviewable changes.
- After analysis or implementation, add a short entry to `docs/PROJECT_MEMORY.md`.
- Before starting non-trivial work, read the "Agent Coordination" and "Active Backlog" sections in `docs/PROJECT_MEMORY.md`.
- When handing off work, leave a dated note with: agent, scope, files touched, verification run, remaining risks, and suggested next step.
- Keep security-sensitive work conservative: auth, verification, payments, contracts, uploads, webhooks, and admin routes need tests or explicit verification.
- If you change package versions, update both `package.json` and matching lockfiles.
- If you start a dev server, verify the UI in a browser before claiming the frontend works.

## Verification Baseline

Dependencies are not currently installed in this checkout. Before judging build health, run:

```bash
npm ci
npm --prefix frontend ci
npm --prefix institution-frontend ci
```

Recommended checks:

```bash
npm run build
npm run test:backend -- --runInBand --forceExit
npm --prefix frontend run build
npm --prefix frontend test
```

## High-Risk Areas

- Public/testing endpoints under `/api/testing/inbound/*`.
- Public notification endpoints `/api/notify/email` and `/api/notify/sms`.
- KYC webhook signature validation.
- Verification routes mounted publicly.
- JWT storage in browser `localStorage`.
- Uploaded files and signed contract PDFs.
- Dependency audit issues in root and frontend lockfiles.
