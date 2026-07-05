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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **RENTALAPP** (3005 symbols, 6217 relationships, 162 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/RENTALAPP/context` | Codebase overview, check index freshness |
| `gitnexus://repo/RENTALAPP/clusters` | All functional areas |
| `gitnexus://repo/RENTALAPP/processes` | All execution flows |
| `gitnexus://repo/RENTALAPP/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
