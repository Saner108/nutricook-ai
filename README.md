# 🌿 NutriCook AI

**Turn your ingredients into personalized recipes — powered by Claude AI.**

NutriCook AI is a full-stack nutrition coaching app that generates personalized meal plans and recipes based on available ingredients, dietary preferences, and health goals. Built as part of the Claude Corps Fellowship portfolio by Cesar, Head Nutrition Coach at TAMUCC Recreational Sports Center.

**[Live demo](https://nutricook-ai-kappa.vercel.app/)**

## Features

| Area | What it does |
|---|---|
| **Home dashboard** | Personalized greeting, animated calorie progress ring, water tracker, AI meal-plan banner, and daily nutrition summary |
| **Weekly planner** | 7-day calendar with expandable meal sections and nutrition/prep details |
| **AI meal generator** *(core feature)* | Ingredient chip input, 6 goal presets, 8 dietary toggles, and 3 generated recipes with full nutrition info and step-by-step instructions |
| **Smart grocery list** | Auto-grouped by category with checkboxes and live progress tracking |
| **Profile** | Health goals, weight tracking, streak counter, macro split visualization, and achievement badges |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Inline styles (iOS design system) |
| AI | Anthropic Claude API (`claude-sonnet-4-6`) |
| Backend | Supabase (auth + persistence), Stripe (subscriptions) |
| Deployment | Vercel |

## Getting Started

```bash
git clone https://github.com/Saner108/nutricook-ai.git
cd nutricook-ai
npm install
npm run dev        # http://localhost:5173
```

### API Key & Demo Mode

The Anthropic API key never touches the browser — it lives server-side in the `/api/generate` Vercel function (`ANTHROPIC_API_KEY`). Locally, a Vite middleware proxies to Anthropic when the key is set and otherwise serves realistic streamed mocks so the UI works offline.

With no Supabase environment variables configured, the app runs in **demo mode** with session-only mock data and no login required.

## Backend Setup (Optional)

NutriCook uses Supabase for auth and persistence, and Stripe for the Pro subscription. Both are optional — leave them unconfigured and the app runs in demo mode.

1. Create a free Supabase project, then copy the Project URL, `anon` key, and `service_role` key.
2. Run `db/migration.sql` in the Supabase SQL editor to create tables, the `handle_new_user` trigger, RLS policies, and the `consume_quota` function.
3. (Optional) Enable Google sign-in under Authentication → Providers.
4. Set environment variables in Vercel (Project Settings) and in `.env.local` locally. See `.env.example`.
5. (Optional) Stripe: create a $4.99/mo recurring price and a webhook at `/api/stripe-webhook` for `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`. Test with `4242 4242 4242 4242`.

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | frontend | Browser client (RLS-scoped), public |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | serverless | Token verification |
| `SUPABASE_SERVICE_ROLE_KEY` | serverless | Quota writes + webhook — never expose |
| `ANTHROPIC_API_KEY` | serverless | Recipe/scan/remix proxy |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | serverless | Pro checkout + webhook (optional) |

**Security:** the `service_role` key stays server-side only; RLS confines every user to their own rows; the Stripe webhook signature is verified; the Anthropic key never reaches the browser.

## Deployment

```bash
# Vercel (recommended)
npm install -g vercel && vercel

# Netlify
npm run build
# drag dist/ to netlify.com/drop
```

## Project Structure

```
nutricook-ai/
├── api/
│   ├── generate.js            # Anthropic proxy (auth + quota gate, streaming)
│   ├── checkout.js            # Stripe Checkout session
│   ├── stripe-webhook.js      # Subscription lifecycle → Supabase
│   └── _lib/supabaseAdmin.js  # service-role helpers (not routed)
├── db/
│   └── migration.sql          # schema + RLS + consume_quota RPC
├── src/
│   ├── lib/                   # supabase client, db access, quota/streak helpers
│   ├── App.jsx                # legacy standalone version (unused)
│   └── main.jsx               # entry → artifacts/NutriCookAI_v2.tsx
├── artifacts/
│   └── NutriCookAI_v2.tsx     # the shipped app (all screens + components)
├── test/                      # node --test unit tests
└── package.json
```

## AI Integration

Recipes stream from Claude through the server-side `/api/generate` proxy, so the browser never sees the API key. A structured JSON prompt keeps output parseable, and recipes render progressively as they stream:

```js
const res = await fetch("/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    stream: true,
    messages: [{ role: "user", content: prompt }],
  }),
});
// SSE deltas are parsed incrementally so finished recipes appear one by one.
```

## Design System

| Token | Value | Use |
|---|---|---|
| `mint` | `#A8F5D3` | Primary accent |
| `mintDark` | `#1A8C5F` | CTA buttons, active states |
| `mintLight` | `#F0FBF6` | Card backgrounds, selections |
| `black` | `#1C1C1E` | Primary text |
| `g4` | `#8E8E93` | Secondary text |
| Border radius | 14–20px | Cards and buttons |

## Business Model

Free tier: 3 recipe generations + 1 fridge scan per day. **Pro ($4.99/mo):** unlimited generation, scans, and remixes. Checkout uses Stripe subscription mode, and the webhook handles lifecycle events.

## Background

Built for the Claude Corps Fellowship (Cohort 1) application. The nutrition coaching focus draws on real client assessment work at TAMUCC — tracking ingredients, macros, and personalized meal planning are daily challenges there. The Excel-based tools in [Excel-Business-Analytics-Portfolio](https://github.com/Saner108/Excel-Business-Analytics-Portfolio) informed this app's data structure.

## Author

**Cesar** — Head Nutrition Coach, TAMUCC Recreational Sports Center · Claude Corps Fellowship Applicant, Cohort 1

## License

MIT
