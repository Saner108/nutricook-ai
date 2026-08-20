# Static hosting — decision resolved

**Decision (2026-08-20): Option A — keep the current architecture.** Vercel
serverless + static frontend stays as-is; no migration planned. Kept below
for reference on why the other options weren't chosen.

Two things currently require a live backend, not just static files:

1. **`api/generate.js`** — proxies to the Anthropic API and holds
   `ANTHROPIC_API_KEY` server-side. If the app were purely static, this key
   would have to move to the browser, which means anyone can extract it from
   devtools/network tab and run up your Anthropic bill.
2. **`api/stripe-webhook.js`, `api/checkout.js`** — Stripe webhooks
   fundamentally require a public server endpoint Stripe can call; there is
   no static-only way to receive "payment succeeded" events.

## Real options

**A. Keep the current architecture (Vercel serverless + static frontend).**
This is already what you have — `vercel.json`'s rewrite serves the SPA for
everything except `/api/*`. "Static" and "has two small serverless
functions" often get conflated; if the goal was "fast, cheap, CDN-served
frontend," you already have that. Only the two API routes are
non-static, and they exist for good reasons (key custody, webhooks).

**B. Move the backend elsewhere, keep the frontend static.**
Split into: a fully static frontend (Vercel static, Netlify, Cloudflare
Pages, GitHub Pages, S3+CloudFront — any of these) + a small separate
backend (a single Cloudflare Worker, a tiny Express app on Fly.io/Render,
or even a different Vercel project just for `/api`) that only handles the
Anthropic proxy and Stripe webhook. This achieves "static frontend" in the
literal sense, but doesn't remove the backend — it relocates it. Meaningful
if you specifically want the frontend on a different host/CDN than Vercel,
otherwise it's added complexity for the same end state as option A.

**C. Expose the Anthropic key client-side and drop the Stripe webhook.**
Genuinely static, no backend at all. Requires: users bring their own
Anthropic key (like the dead `src/App.jsx` pattern), and monetization
would need a different mechanism than Stripe webhooks (e.g. a
one-time Stripe Payment Link with no server-side verification, or removing
paid tiers entirely). This is a real regression in security and product
capability — not recommended, but it's the only path to *actually* zero
backend.

## What I'd need to proceed

Which of these is the actual goal? "Static hosting" usually means one of:
- Cheaper/simpler hosting (→ you likely already have this; A applies)
- A specific static host you want to use for some other reason (→ B)
- No backend at all, accepting the trade-offs (→ C, not recommended without
  understanding what it gives up)

Nothing here is code I can write speculatively — B and C both mean
deleting/restructuring how the API key and payments work, which is
exactly the kind of large, working-code change your own rules say to
plan before touching.
