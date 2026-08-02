# NutriCook AI — Case Study

**Author:** Cesar · Head Nutrition Coach, TAMUCC Recreational Sports Center  
**Built for:** Claude Corps Fellowship (Cohort 1) · [Live demo](https://nutricook-ai-kappa.vercel.app/)

---

## The Problem I Was Actually Solving

Every week I sit down with student athletes and help them build meal plans. The bottleneck isn't knowledge — it's time and personalization. A student hands me a list of what's in their fridge (half a chicken breast, some rice, frozen broccoli), tells me they're trying to hit 165g of protein, and I spend 10–15 minutes mapping that into a real meal with macros before we can even talk about the week.

Multiply that by 20 clients and it's a scheduling problem, not a nutrition problem. The knowledge exists. What was missing was a system that applied it at scale.

NutriCook AI is that system.

---

## Architecture Decisions

### Why Supabase over Clerk + Neon

I evaluated both stacks. Clerk has a better auth DX, but splitting auth and database across two vendors means two JWTs, two SDKs, and two failure surfaces in the serverless functions. Supabase auth tokens are native to Postgres RLS — the same credential that unlocks the UI also scopes every database read and write. One vendor, one session, far less complexity in `api/generate.js`.

The trade-off: Supabase's auth UI is less polished out of the box. I built custom auth screens (AuthScreen component) to match the app's design system, which also let me control the exact copy users see on each error path (expired email, already-registered address, pending confirmation).

### Server-Side Quota Enforcement Only

The free tier (3 recipe generations + 1 fridge scan per day) could have been enforced client-side. I deliberately didn't do that.

Client-side quota is a UI feature. Server-side quota is a business rule. The distinction matters: a motivated user can clear `localStorage`, swap tokens, or open DevTools and edit state. The `consume_quota` Postgres function runs as an atomic upsert with a `service_role` key the browser never sees. The frontend doesn't decide whether a user can generate — it asks the server, and the server's answer is final (200 or 402).

This also means the meter the user sees is always accurate, not an optimistic estimate.

### The Agent Orchestration Pipeline

The most unusual piece of this project's architecture isn't the app itself — it's how changes to it are made.

Every schema or API change goes through four phases with a human checkpoint in the middle:

```
schema-planner (plan only) → Cesar reviews → migration-executor (execute) → test-runner (verify)
```

This came from a real problem I hit in early development: moving fast on schema changes meant I'd write a migration, deploy it, and then discover it broke a serverless function three steps later. The agent pipeline forces the plan and the execution to be two separate moments. By the time migration-executor writes the SQL, the risks have already been named.

The test-runner agent is intentionally limited — it runs the suite and reports failures. It can't fix anything. That constraint keeps the human in the loop on all substantive decisions while removing the friction of running tests manually.

### Streaming Recipe Generation

Recipes generate progressively — each one appears as Claude finishes writing it, not after all three are done. This required treating the SSE stream not as a blob to parse at the end, but as a continuous input to `extractRecipes`, which uses brace-depth tracking to identify completed recipe objects inside the partial JSON as they arrive.

The streaming contract is frozen (`streamRecipes(apiKey, prompt, onUpdate, fetchFn)`) and pinned by tests. The injectable `fetchFn` parameter means the full streaming pipeline can be unit-tested without a live network or a running server — the tests pass a stub reader and verify both the resolved recipes and the in-progress updates.

---

## What I Built (and What It Does)

| Feature | How it works |
|---|---|
| **Fridge Scan** | Photo → base64 → Claude Vision via `/api/generate` → detected ingredients merge into the chip list |
| **Recipe Generator** | Ingredient chips + goal preset + dietary toggles → structured JSON prompt → streaming SSE → 3 progressive recipe cards |
| **AI Remix** | Each recipe card has 5 remix actions (spicier, more protein, fewer calories, 2x servings, swap ingredient) that rewrite the card in place via the same Claude proxy |
| **Weekly Planner** | 7-day calendar backed by real `meal_logs` — marking a meal done on Home logs it and builds history |
| **Real streak** | Computed from consecutive days with ≥1 done meal in `meal_logs`, with a grace day if today isn't logged yet |
| **Grocery list** | Saving an AI recipe pushes its ingredients (with quantities) into the list, grouped by aisle |
| **Pro subscription** | Stripe Checkout → webhook → `subscriptions` upsert (service role) → Pro status is the DB row, not client state |
| **Dark mode** | CSS custom properties off `data-theme`; follows OS by default; toggle in Profile |
| **Demo mode** | When Supabase env vars are absent, the entire app runs with mock session state — zero setup required to try it |

---

## Measurable Outcomes

- **35 tests, 0 failures** — quota logic, streak computation, streaming parser, security surface, and source-level contracts all covered
- **~10 minutes → ~90 seconds** — time to generate a personalized 3-meal plan from a pantry list (based on manual timing with actual clients)
- **$0/month infrastructure** at current usage — Supabase free tier, Vercel hobby, Anthropic pay-per-use
- **Demo-mode zero friction** — anyone can try the full UI at the live URL without creating an account

---

## What I Learned

**AI works best as a proxy, not a peer.** Early prototypes had the frontend call Anthropic directly. That felt fast to build but was architecturally wrong — the API key lived in the browser, quota enforcement was impossible, and streaming broke in subtle ways across browsers. Moving everything behind a Vercel serverless function made the AI a controlled backend resource rather than a UI widget. The browser's job is to display; the server's job is to decide.

**The plan/execute split pays off immediately.** The four-agent pipeline felt like overhead when I set it up. It paid for itself the first time I wrote a schema plan, read it back the next day, and caught a missing `ON DELETE CASCADE` before it went anywhere near production. The checkpoint isn't bureaucracy — it's the diff between thinking fast and thinking carefully.

**Dietary restrictions as shared state.** The original design had dietary toggles only on the generator screen. Users kept re-setting them. Moving prefs to the profile (and syncing them to the generator on load) was a small change that made the app feel intelligent about who you are rather than stateless.

---

## Why This Matters for the Fellowship

Claude Corps is about building systems that change how people work, not just automating individual tasks. NutriCook started as a "what if I could save 10 minutes per client session" question and became a real system with auth, persistence, payments, a test suite, and a deployment pipeline — because each answer revealed the next real question.

The nutrition coaching context is real. The client sessions are real. The time saved will be real. And the patterns here — streaming AI outputs, server-side enforcement, human-in-the-loop agent pipelines — generalize to any domain where you want AI to augment professional judgment without replacing human review.

That's the kind of builder I want to be. This project is the proof.
