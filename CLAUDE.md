# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See `.claude/CLAUDE.md` for subagent usage rules and the frozen-contract list — read it before touching schema, migrations, API auth/quota, or design tokens.

## Commands

```bash
npm install
npm run dev          # Vite dev server, http://localhost:5173
npm run build         # production build (dist/)
npm run build:ds      # builds the design-system bundle only (vite.ds.config.js)
npm run preview       # preview a production build

node test/run.mjs     # run the full test suite (node:test, no separate test script defined)
node --test test/quota.test.mjs   # run a single test file directly
```

There is no lint script configured. GitHub Actions (`.github/workflows/`) runs tests + a build smoke-check on every push/PR to `main`; Vercel auto-deploys `main` separately.

`test/run.mjs` is a custom runner: it invokes `node:test` over every `test/*.test.mjs` file and also writes results to `.claude/tdd-guard/data/test.json` (in both this repo root and its parent, since tdd-guard resolves `.claude/` relative to wherever the session started) because tdd-guard has no built-in `node:test` reporter. Prefer `node test/run.mjs` over `node --test` directly when the tdd-guard plugin is in use.

## Architecture

**The shipped app is `artifacts/NutriCookAI_v2.tsx`** (~2400 lines, all screens + components), entered via `src/main.jsx`. `src/App.jsx` is a legacy standalone build and is frozen/unused — do not edit it.

**Client → server → AI flow:** the UI calls `/api/generate` (never the Anthropic API directly), which streams SSE deltas back that get parsed incrementally so recipes render as they arrive. Locally, `vite.config.js` registers dev-only middleware (`configureServer`) on `/api/generate` and `/api/checkout` that proxies to Anthropic when `ANTHROPIC_API_KEY` is set, and otherwise serves realistic streamed mocks — so the UI works fully offline in dev. In production these paths are Vercel serverless functions under `api/`.

**Demo mode:** with no Supabase env vars configured, the app runs entirely on session-only mock data with no login required — this is the default local dev experience.

**Backend layout (`api/`):**
- `api/generate.js` — Anthropic proxy: auth + quota gate, then streams the response
- `api/checkout.js`, `api/stripe-webhook.js` — Stripe subscription checkout and lifecycle sync to Supabase
- `api/admin/` — allowlisted admin routes; files prefixed `_` (`_allowlist.js`, `_logAction.js`, `_requireAdmin.js`) are helpers, not routed endpoints
- `api/_lib/supabaseAdmin.js` — service-role Supabase client, server-only

**Quota/streak logic** lives in `src/lib/quota.js` as pure functions shared (via duplication, not import — check before assuming a single source) between frontend display and the serverless quota gate. Server-side `consume_quota` RPC (defined in `db/migration.sql`) is the actual source of truth for enforcement; client-side numbers are display-only.

**Database:** three migration files in `db/`, applied manually in the Supabase SQL editor — there's no migration runner:
- `migration.sql` — core schema, RLS policies, `handle_new_user` trigger, `consume_quota` RPC
- `migration_ratelimit.sql` — `rate_limit_hits` table + `check_rate_limit` RPC
- `migration_admin_logs.sql` — service-role-only audit log

**Design system:** `src/design-system/` holds reusable components (Button, MacroBar, MacroRow, MealCard, Ring, AICard) and `tokens.js`, exported as `T`. All styling in the shipped app must reference `T` — no raw hex (enforced as a frozen contract, see `.claude/CLAUDE.md`).

**Subagents** (`.claude/agents/`): `schema-planner`, `migration-executor`, `api-auth-builder`, `test-runner` implement a plan → human-approval → execute → verify workflow for backend/schema changes. Full rules in `.claude/CLAUDE.md`.

## Known repo state

`README.md` currently has unresolved git merge-conflict markers (`<<<<<<<`/`=======`/`>>>>>>>`) in the Backend Setup and Deployment sections — be aware the content there is a merged-but-unresolved mix of two branches, not necessarily accurate as written.
