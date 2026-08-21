# NutriCook AI

AI-powered meal planning app. Target users: fitness-minded individuals managing macros and meal prep.

## Tech Stack
- Frontend: React (Vite), `artifacts/NutriCookAI_v2.tsx` is the **only** shipped file — do not edit `src/App.jsx` (frozen/legacy)
- Backend: Vercel serverless functions under `api/`
- AI: Anthropic Claude via `api/generate.js` proxy (never call Anthropic directly from the frontend)
- Auth/DB: Supabase (optional — app runs in demo mode without it)
- Payments: Stripe via `api/checkout.js` + `api/stripe-webhook.js`

## Key Files
- `artifacts/NutriCookAI_v2.tsx` — full UI, all screens and components
- `api/generate.js` — Anthropic proxy: auth + quota gate + SSE streaming
- `src/lib/quota.js` — shared quota/streak logic (used by both UI and API)
- `src/lib/db.js` — Supabase data layer
- `src/design-system/tokens.js` — design tokens (frozen, always use `T.*`)
- `db/migration*.sql` — apply manually in Supabase SQL editor; no migration runner

## Frozen Contracts
- `streamRecipes(apiKey, prompt, onUpdate, fetchFn)` — signature is frozen
- Never add `<form>` tags, `localStorage`, or `sessionStorage`
- Never call Anthropic from the browser — always go through `api/generate.js`
- Never add client-side quota counting — `consume_quota` RPC is the source of truth
- Design tokens `T.*` only — no raw hex values
- Mobile frame: 430px max-width, frozen

## Model Allowlist
`api/generate.js` pins allowed models server-side (`ALLOWED_MODELS` set). When a new Claude model needs to be used, **both** files must be updated together:
1. Client call site in `artifacts/NutriCookAI_v2.tsx`
2. `ALLOWED_MODELS` in `api/generate.js`

Unknown model strings silently fall back to `claude-sonnet-4-6`.

## Commands
```bash
npm run dev       # dev server at localhost:5173
npm run build     # production build
node test/run.mjs # full test suite
```

## Sub-agents (.claude/agents/)
schema-planner → migration-executor → api-auth-builder → test-runner
Always: plan → Cesar approves → execute → verify → Cesar commits manually

## Skills
- /repo-routine: Full repo audit + AI-firstify + UX review (see .claude/skills/repo-routine/)
