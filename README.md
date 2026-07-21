# 🌿 NutriCook AI

**Turn your ingredients into personalized recipes — powered by Claude AI.**

NutriCook AI is a full-stack nutrition coaching application that generates personalized meal plans and recipes based on available ingredients, dietary preferences, and health goals. Built as part of the Claude Corps Fellowship portfolio by Cesar, Head Nutrition Coach at TAMUCC Recreational Sports Center.

---

## Live Demo

> Open the project in Claude.ai or deploy via Vercel/Netlify for a shareable link.

---

## Features

**🏠 Home Dashboard**
- Personalized greeting and daily nutrition summary
- Animated calorie progress ring with macro breakdown (protein, carbs, fat)
- Water intake tracker
- AI meal plan banner with one-tap regeneration
- Today's meal cards with AI confidence scores

**📅 Weekly Meal Planner**
- 7-day horizontal calendar navigation
- Expandable meal sections (Breakfast, Lunch, Dinner, Snack)
- Meal details with nutrition info, prep time, and difficulty

**🌿 AI Meal Generator** *(core feature)*
- Ingredient chip input — type and press Enter to add
- Quick-add common ingredients
- 6 nutrition goal presets (Fat Loss, Muscle Gain, Maintenance, etc.)
- 8 dietary preference toggles (Vegan, Gluten-Free, Keto, etc.)
- Generates 3 personalized recipes with full nutrition info
- Animated macro bars per recipe
- Step-by-step instructions

**🛒 Smart Grocery List**
- Auto-grouped by category (Proteins, Vegetables, Grains, Fruits, Dairy)
- Interactive checkboxes with live progress bar
- Tap any category to expand/collapse

**👤 Profile**
- Health goals, weight tracking, streak counter
- Macro split visualization
- Achievement badges
- App settings

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Inline styles (iOS design system) |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| Deployment | Vercel / Netlify |

---

## Getting Started

### Prerequisites
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/nutricook-ai.git
cd nutricook-ai

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### API key & demo mode

The Anthropic API key is **never entered in the browser**. It lives server-side in the
`/api/generate` Vercel function (env var `ANTHROPIC_API_KEY`). During local `npm run dev`,
a Vite middleware serves `/api/generate`: it proxies to Anthropic when `ANTHROPIC_API_KEY`
is set, and otherwise returns realistic streamed mocks so the whole UX works offline.

With no Supabase env vars configured the app runs in **demo mode** — session-only mock
data, no login required — exactly as it did before Phase 4.

---

## Backend setup (Phase 4)

NutriCook uses **Supabase** for auth + persistence and **Stripe** for the Pro
subscription. Both are optional: leave them unconfigured and the app runs in demo mode.

1. **Create a free Supabase project.** Copy the Project URL, the `anon` public key,
   and the `service_role` key (Settings → API).
2. **Run the migration.** Paste `db/migration.sql` into the Supabase SQL editor and run
   it. This creates every table, the `handle_new_user` trigger, Row-Level Security
   policies, and the `consume_quota` enforcement function.
3. **(Optional) Enable Google sign-in** under Authentication → Providers.
4. **Set env vars** (in Vercel → Project Settings, and locally in `.env.local` — see
   `.env.example`):

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | frontend | Browser client (RLS-scoped). Public. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | serverless | Token verification. |
| `SUPABASE_SERVICE_ROLE_KEY` | serverless | Quota writes + webhook. **Never expose.** |
| `ANTHROPIC_API_KEY` | serverless | Recipe/scan/remix proxy. |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | serverless | Pro checkout + webhook (optional). |

5. **(Optional) Stripe:** create a $4.99/mo recurring Price, and a webhook endpoint
   pointing at `/api/stripe-webhook` for `checkout.session.completed`,
   `customer.subscription.updated`, and `customer.subscription.deleted`. Test with card
   `4242 4242 4242 4242`.

**Security notes:** the `service_role` key stays server-side only; RLS confines every
user to their own rows (verify by attempting a cross-user read from a second account);
the Stripe webhook signature is verified; the Anthropic key never reaches the browser.

---

## Deployment

### Vercel (recommended)
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm run build
# Drag the `dist/` folder to netlify.com/drop
```

---

## Project Structure

```
nutricook-ai/
├── api/
│   ├── generate.js         # Anthropic proxy (auth + quota gate; streaming)
│   ├── checkout.js         # Stripe Checkout session
│   ├── stripe-webhook.js   # Subscription lifecycle → Supabase
│   └── _lib/supabaseAdmin.js  # service-role helpers (not routed)
├── db/
│   └── migration.sql       # schema + RLS + consume_quota RPC
├── src/
│   ├── lib/                # supabase client, db access layer, quota/streak helpers
│   ├── App.jsx             # legacy standalone version (unused)
│   └── main.jsx            # React entry → artifacts/NutriCookAI_v2.tsx
├── artifacts/
│   └── NutriCookAI_v2.tsx  # the shipped app (all screens + components)
├── test/                   # node --test unit tests
├── vite.config.js
├── package.json
└── README.md
```

---

## AI Integration

The AI Generator streams recipes from Claude through the server-side `/api/generate`
proxy — the browser never sees the API key. A structured JSON prompt keeps output
parseable, and recipes render progressively as they stream in:

```javascript
// Streamed request through the proxy (key stays server-side)
const res = await fetch("/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-6", max_tokens: 1500, stream: true,
    messages: [{ role: "user", content: prompt }],
  }),
});
// SSE deltas are parsed incrementally so finished recipes appear one by one.
```

---

## Design System

Inspired by Apple Human Interface Guidelines:

| Token | Value | Use |
|-------|-------|-----|
| `mint` | `#A8F5D3` | Primary accent |
| `mintDark` | `#1A8C5F` | CTA buttons, active states |
| `mintLight` | `#F0FBF6` | Card backgrounds, selections |
| `black` | `#1C1C1E` | Primary text |
| `g4` | `#8E8E93` | Secondary text |
| Border radius | 14–20px | Cards and buttons |

---

## Background

This project was built as part of the **Claude Corps Fellowship (Cohort 1)** application. The nutrition coaching focus comes from real-world experience building client assessment programs at TAMUCC, where tracking ingredients, macros, and personalized meal planning are daily challenges for coaching clients.

The Excel-based tools in this portfolio (Budget Tracker, Cooking Inventory) informed the data structure for the meal planning and grocery list features.

---

## Author

**Cesar** — Head Nutrition Coach, TAMUCC Recreational Sports Center  
Claude Corps Fellowship Applicant, Cohort 1

---

## License

MIT — free to use, modify, and share.

---

## Environment Variables (Vercel → Project Settings)

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | For live AI | Powers recipe generation, fridge scan, and remixes via the `/api/generate` proxy. Never exposed to the browser. |
| `STRIPE_SECRET_KEY` | Optional | Enables real Stripe Checkout for NutriCook Pro (use test-mode keys first). |
| `STRIPE_PRICE_ID` | Optional | The recurring price for the $4.99/mo Pro subscription. |
| `STRIPE_WEBHOOK_SECRET` | Optional | Verifies `api/stripe-webhook.js` events. |

Without the Stripe keys, upgrading simulates instantly (demo mode). Without the Anthropic key, local dev serves realistic mocks.

## Business Model

Free tier: **3 recipe generations + 1 fridge scan per day** — enough to love the app.
**NutriCook Pro ($4.99/mo):** unlimited generation, unlimited fridge scans, unlimited AI remixes until the next billing date. Checkout via Stripe subscription mode; webhook receives lifecycle events. (Per-user enforcement across devices requires auth + a datastore — the next phase.)
