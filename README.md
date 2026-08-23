# 🌿 NutriCook AI

**Turn your ingredients into personalized recipes — powered by Claude AI.**

NutriCook AI is a full-stack nutrition coaching app that generates personalized recipes based on what you have in your kitchen, your dietary preferences, and health goals. Built as part of the Claude Corps Fellowship by Cesar Sanchez, Head Nutrition Coach at TAMUCC Recreational Sports Center.

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
│   └── migration_indexes.sql     ← Run last: performance indexes (safe, non-destructive)
└── test/                         ← 96 tests, 0 failures
    ├── backend.test.mjs
    ├── extractRecipes.test.mjs
    ├── ingredients.test.mjs      ← parseIngredientInput: 25 cases including dozen/handful/pinch
    ├── quota.test.mjs
    └── security.test.mjs         ← Webhook replay, JWT, ALLOWED_MODELS, token cap
```

## Getting started

```bash
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (optional — app works without them)
# Fill in ANTHROPIC_API_KEY for real recipe generation (mock data used without it)
npm install
npm run dev      # localhost:5173
npm run build    # production build
node test/run.mjs  # run test suite
```

## Environment variables

See `.env.example` for the full list with descriptions. The app runs in **demo mode** (session-only mock data) without any Supabase or Stripe config.

## Security

- All Anthropic API calls go through `api/generate.js` — never from the browser
- Model and max_tokens are both pinned server-side (client values are advisory)
- Stripe webhook signature verified with replay-attack protection (300s window)
- JWT `exp`, `iat`, and `nbf` claims all validated on the local fast-path
- Admin endpoints gated by email allowlist (`ADMIN_EMAILS` env var, fail-closed)
- HTTP security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- Immutable cache headers on `/assets/*` for optimal CDN caching
