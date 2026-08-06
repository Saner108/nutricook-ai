# Session changes — handoff notes

Live app entry point: `src/main.jsx` → `artifacts/NutriCookAI_v2.tsx` (this is
the real, deployed component). `src/App.jsx` is **dead code**, not imported
anywhere — it also calls Anthropic directly from the browser with a
user-entered key, which would leak that key if it were ever wired back up.
Left in place but unused; consider deleting or clearly marking deprecated.

## Done this session

1. **JSON/payload compression** — `artifacts/NutriCookAI_v2.tsx`: added
   `downscaleImageToBase64()`, used by `handleFridgePhoto` to resize fridge
   scan photos to max 1024px / JPEG q0.72 via canvas before upload, instead
   of sending the raw file as base64. Cuts request size and Anthropic image
   tokens on the scan path (the only meaningfully large payload in the app).

2. **Batch DB writes** — `src/lib/db.js` (`seedStarter`) and
   `artifacts/NutriCookAI_v2.tsx` (onboarding `finish()`): independent writes
   now run via `Promise.all` instead of sequential `await`. `saveRecipe()`
   was left sequential — its steps genuinely depend on each other's result
   (recipe id needed for try_list/grocery inserts).

3. **Latency audit** — read-only. `/api/generate` does two sequential
   Supabase round-trips (`getUser` then `consume_quota`-style RPC) before
   ever calling Anthropic. The real fix (verify the Supabase JWT locally
   instead of a network call) needs the project's JWT secret and changes how
   revoked sessions are handled — **not done**, flagged as a follow-up that
   needs deliberate scoping, not a silent swap of auth logic.

4. **Rendering optimization** — **not done**. No profiling data / no
   specific slow screen was identified. Needs a target before touching
   `memo`/`useCallback` anywhere — otherwise it's speculative churn.

5. **Static hosting** — **not done, architecturally blocked**. The
   Anthropic API key (`api/generate.js`) and Stripe webhook
   (`api/stripe-webhook.js`, `api/checkout.js`) both require a live backend.
   Full static hosting isn't compatible without replacing that server-side
   logic with something else (e.g. a different backend, or client-side keys
   which is a security regression). Needs a real decision, not a code change.

6. **Rate limiting** — two parts:
   - `db/migration_ratelimit.sql` (new file, run separately from
     `migration.sql`): adds `rate_limit_hits` table + `check_rate_limit(uuid,
     int)` function, a 60-second sliding window, default 20 req/min/user.
     **This migration has not been run against the live Supabase project —
     run it before deploying, or `/api/generate` will fail-open on the rate
     check (treated the same as a transient DB error).**
   - `api/generate.js`: calls `check_rate_limit` right after auth, before the
     daily quota check, returns `429 { error: { code: "rate_limited" } }`.
   - `artifacts/NutriCookAI_v2.tsx` (`AuthScreen`): added a client-side
     escalating cooldown after 5 failed sign-in attempts (2s → 4s → 8s...
     capped at 60s). This is a UX speed bump only — Supabase Auth already
     rate-limits sign-in server-side; this doesn't replace that.

7. **Real auth provider** — already existed (Supabase Auth, email/password +
   Google/Apple OAuth). No change needed.

8. **Row Level Security** — already existed and is solid: every table has
   RLS enabled with `using` + `with check`, `subscriptions`/`usage_counters`
   are read-only for clients with writes reserved for the service-role key.
   No change needed.

9. **Secrets audit** — clean. `.gitignore` covers `.env*`, only
   `.env.example` (empty template) is tracked, no key-shaped strings
   anywhere in current source or full git history.

10. **Session token storage** — `src/lib/supabase.js`: client now created
    with `{ auth: { persistSession: false } }`. Tokens live in memory only,
    not localStorage. **Trade-off, explicitly accepted:** users are signed
    out on a hard page refresh.

11. **Admin panel** — **not built**. No admin role/feature exists in the app
    at all currently (confirmed nothing leaked client-side). A real admin
    panel (view users, comp subscriptions, adjust quotas) was scoped as a
    separate future session — needs its own plan: new service-role-gated API
    routes, an allowlist check, action logging. Not started.

12. **Password check on login** — `artifacts/NutriCookAI_v2.tsx`
    (`AuthScreen.submit`): client-side minimum-8-character check, but only
    on the **signup** path, not signin (existing users may have shorter
    passwords predating any policy — rejecting those client-side would
    incorrectly lock them out).

## Open items / needs a decision before more code

- #4 rendering: needs a specific slow screen/interaction to target.
- #5 static hosting: needs a decision on what replaces the Anthropic-key
  proxy and Stripe webhook if going static.
- #3 JWT-local-verification: real latency win, but is a security-sensitive
  auth change — wants a dedicated review, not a quick patch.
- #11 admin panel: needs your actual use case (what should an admin be able
  to do?) before scoping real work.
- **Run `db/migration_ratelimit.sql` against Supabase** before relying on
  rate limiting in production.
