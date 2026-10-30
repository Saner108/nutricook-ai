# 🌿 NutriCook AI

**Turn your ingredients into personalized recipes — powered by Claude AI.**

NutriCook AI is a full-stack nutrition coaching project that generates recipes based on kitchen ingredients, dietary preferences, and goals. Created by Cesar Sanchez, drawing on prior nutrition-coaching experience at Texas A&M University–Corpus Christi.

**[Live demo](https://nutricook-ai-kappa.vercel.app/)**

---

## Features

| Area | What it does |
|---|---|
| **Home dashboard** | Personalized greeting, animated calorie progress ring, interactive water tracker, AI meal-plan banner, daily nutrition summary |
| **Weekly planner** | 7-day calendar with expandable meal sections, per-meal Swap button (navigates to AI generator), and nutrition/prep details |
| **AI meal generator** | Weight-aware ingredient input (`8 oz chicken`, `200g salmon`, `1/2 cup oats`), servings selector (1–8), 6 goal presets, 8 dietary toggles — generates 3 streaming recipes with validated per-serving macros |
| **Fridge scan** | Camera scan extracts ingredient names **and quantities** from packaging visible in the photo |
| **Smart grocery list** | Auto-grouped by category; saving a recipe parses ingredient strings into `{name, qty}` so the basket shows clean quantities |
| **Insights** | Weekly nutrition trends, macro breakdown charts, streak tracking |
| **Profile** | Health goals, weight logging, achievement badges, notification prefs, dietary restrictions, privacy info |

## How recipes are generated

1. User enters ingredients with optional weights: `8 oz chicken`, `2 cups broccoli`
2. User selects goal (Fat Loss, Muscle Gain, etc.) and number of servings
3. A structured prompt is sent to `api/generate.js` → Claude Sonnet via SSE
4. The app parses streaming JSON in real-time — recipe name appears while it's still being written
5. On completion, `sanitizeMacros()` validates every macro field and recalculates calories using protein×4 + carbs×4 + fat×9 if the stated value is off by more than 10%

## Nutrition facts

Macros are **Claude's estimates** — no external database. The prompt includes:
- Ingredient weights when provided
- Number of servings (so per-serving math is correct)
- The calorie formula: `calories = protein×4 + carbs×4 + fat×9`

`sanitizeMacros()` then clamps to positive integers and auto-corrects calories. The UI shows "AI-estimated nutrition · values are approximate."

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite — single self-contained artifact (`artifacts/NutriCookAI_v2.tsx`) |
| AI | Anthropic Claude Sonnet via serverless proxy (`api/generate.js`) |
| Auth / DB | Supabase (optional — runs in demo mode without it) |
| Payments | Stripe Checkout + webhook |
| Hosting | Vercel (serverless functions for API routes) |

## Project structure

```
nutricook-ai/
├── artifacts/NutriCookAI_v2.tsx  ← THE shipped app (do not edit src/App.jsx)
├── api/
│   ├── generate.js               ← Anthropic proxy (ALLOWED_MODELS allowlist, max_tokens cap)
│   ├── checkout.js               ← Stripe Checkout session
│   ├── stripe-webhook.js         ← Subscription lifecycle (replay-attack protected)
│   └── admin/                    ← Admin endpoints (email allowlist gated)
├── src/lib/
│   ├── ingredients.js            ← parseIngredientInput() + ingLabel() — quantity parser
│   ├── quota.js                  ← Free tier limits and streak logic
│   ├── db.js                     ← Supabase data layer
│   └── supabase.js               ← Client initialization
├── db/
│   ├── migration.sql             ← Run first: core schema + consume_quota RPC
│   ├── migration_ratelimit.sql   ← Run second: rate limiting
│   ├── migration_admin_logs.sql  ← Run third: audit log
│   ├── migration_indexes.sql     ← Performance indexes
│   ├── migration_profile_rls.sql ← Prepared policy-only addendum for existing databases; not applied
│   └── test_profile_rls.sql      ← Manual rollback-only checks for an isolated database; not run
└── test/                         ← Node test suite; see validation commands below
    ├── backend.test.mjs
    ├── extractRecipes.test.mjs
    ├── ingredients.test.mjs      ← parseIngredientInput: 25 cases including dozen/handful/pinch
    ├── handlers.test.mjs         ← Actual API handlers with mocked services and signed webhook fixtures
    ├── persistence.test.mjs      ← Save errors, grocery IDs, overlapping saves and auth transitions
    ├── quota.test.mjs
    ├── security.test.mjs         ← Webhook replay, JWT, ALLOWED_MODELS, token cap
    ├── setup.test.mjs            ← Server-only local environment loading
    └── startup.test.mjs          ← Bundle, import and render the shipped application
```

## Getting started

Use a patched, supported Node.js 22 or 24 release; the locked Supabase packages require Node.js 22 or later. Local validation uses a temporary Node.js 24.22.2 runtime without changing project dependencies or the system installation.

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (optional — app works without them)
# Fill in ANTHROPIC_API_KEY for real recipe generation (mock data used without it)
npm ci
npm run dev      # localhost:5173
npm run build    # production build
node test/run.mjs  # run test suite
```

## Environment variables

See `.env.example` for the full list. Keep service-role, Anthropic, and Stripe secrets server-side; never prefix them with `VITE_`.

| Context | Actual behavior |
|---|---|
| `npm run dev`, no Anthropic key | Vite serves sample recipes, scan results, and simulated checkout; no real AI or payment calls |
| `npm run dev`, Anthropic key in `.env.local` | The development proxy loads the server-only key and makes real Anthropic requests; local checkout remains simulated |
| Vercel deployment | `/api/generate` requires `ANTHROPIC_API_KEY`; missing configuration returns an error, not sample recipes |
| No frontend Supabase variables | Session-only demo; recipes, groceries, and preferences do not survive a reload |
| Configured Supabase | Sign-in and persistence use Supabase; configure matching server variables and apply reviewed schema before production use |
| Stripe configured | Checkout redirects to Stripe; only verified server-side subscription state grants live Pro access |

The Vite development middleware does **not** exercise the deployed authentication, quota, Stripe, or webhook handlers. Run handler tests separately. Do not deploy an unrestricted AI proxy: Supabase authentication and server-side quota configuration must be verified before enabling public paid AI usage.

## Maintenance changes — October 30, 2026

- Fixed the shipped React entry point and added an import/render regression test; a successful bundle alone had not caught the blank-screen failure.
- Hardened webhook verification, subscription-write failure handling, invoice ownership, request validation, and fail-closed metering.
- Made recipe and grocery persistence report errors and retain server-assigned IDs; live generation uses authenticated requests and server quota responses.
- Restricted checkout simulation to demo mode and stopped treating a checkout-return URL as proof of a paid subscription.
- Fixed sign-in bootstrapping after checkout navigation and serialized overlapping recipe saves to avoid duplicate shared ingredients.
- Fixed local `.env.local` loading and documented local mock versus deployed behavior, runtime requirements, and AI-estimated nutrition.
- Prepared the approved profile-policy addendum, matching fresh-install correction, and isolated database verification script. No SQL was executed.

These notes describe source changes, not deployment proof. Database-policy remediation and dependency upgrades require separate review; no live payment or production database mutation is part of local validation.

### Validation recorded October 30, 2026

- `node test/run.mjs`: **246 passed, 0 failed, 0 skipped** using temporary Node.js 24.22.2 and the existing lockfile.
- `npm run build` and `git diff --check`: passed. Project dependency versions and the system Node.js installation were not changed.
- Local browser checks: dashboard startup, three streamed sample recipes, recipe Save, recipe ingredients in Basket, manual grocery add/toggle, and the final compiled frontend with no app console errors.
- Handler/persistence tests use controlled service mocks and signed fixtures; they do not establish live Stripe/Supabase behavior. The webhook timestamp test uses a fixed clock without changing production signature limits.
- `db/test_profile_rls.sql` is an **unexecuted**, rollback-only script for a separately authorized isolated database. Neither the base schema nor the new policy addendum was applied to a live database.

### Known limits before production use

- Databases using the original profile `FOR ALL` policy still allow owner deletion and cascading removal of linked records, including usage counters. The prepared correction has not been applied or tested in a database; deployed policies and grants require separate verification and approval.
- Recipe, Want-to-Try, and grocery writes are separate operations, not one transaction. Confirmed recipe IDs are reused on retry, but a lost insert response can still cause duplicates; server-side idempotency remains follow-up work.
- Subscription updates, deletions, and failed invoices cannot replace a different stored subscription. Older checkout-completed events and broader event ordering still need dedicated handling and tests.
- Dependency advisories and real authenticated Supabase/Stripe workflows remain separate checks; passing mocked tests is not production-service verification.

## Security

- All Anthropic API calls go through `api/generate.js` — never from the browser
- Model and max_tokens are both pinned server-side (client values are advisory)
- Stripe webhook requires its signing secret and validates the signature with a 300-second timestamp window; failed subscription writes return retryable errors
- JWT `exp`, `iat`, and `nbf` claims all validated on the local fast-path
- Admin endpoints gated by email allowlist (`ADMIN_EMAILS` env var, fail-closed)
- HTTP security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- Immutable cache headers on `/assets/*` for optimal CDN caching
