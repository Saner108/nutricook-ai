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

11. **Admin panel** — **API layer started; no UI.** There is still no admin
    surface in the frontend, and nothing admin-related is exposed
    client-side. What now exists is one read-only serverless route plus the
    plumbing around it:
    - `db/migration_admin_logs.sql` (new): `admin_logs` audit table. RLS on
      with **zero policies** (no client may read it, not even the audited
      user) plus `revoke all from anon, authenticated` as defense in depth.
      Nullable actor columns + `outcome ('ok'|'denied'|'error')` so denied
      and unauthenticated attempts are recordable. No FKs on the actor/target
      columns on purpose — a cascade would let deleting a user erase the
      record that an admin deleted them.
    - `api/admin/_allowlist.js`: admins come from the `ADMIN_EMAILS` env var,
      not source. Unset/empty = empty allowlist = everyone denied.
    - `api/admin/_requireAdmin.js`: identity comes only from the verified
      Supabase token, never from a param/header/body — that is what makes an
      `admin_logs` row a fact rather than a claim.
    - `api/admin/_logAction.js` + `api/admin/getUser.js`: the route is
      **fail-closed** — the audit row is written before any data is returned,
      and a failed write aborts the read with a 500. This is deliberately the
      opposite of the fail-open quota policy in `api/generate.js`.
    - `api/_lib/supabaseAdmin.js`: added `getUserByEmail()` (GoTrue Admin API;
      `profiles` has no email column) and `insertRow()` (plain insert — the
      existing `upsert()` sends `merge-duplicates`, which could overwrite an
      audit record).
    **Two things gate this working at all:** run the migration, and set
    `ADMIN_EMAILS` in Vercel. Until both are done every `/api/admin/*` call
    returns 401 (no allowlist) or 500 (no table).
    Still unscoped: comp subscriptions, quota adjustment, any UI.

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
- **Run `db/migration_admin_logs.sql` against Supabase** before using the
  admin routes. Unlike the rate-limit migration this one does not fail open —
  `/api/admin/getUser` refuses to return data when it can't write an audit
  row, so a missing `admin_logs` table means every call 500s. That is the
  intended behavior, not a bug.
- **Set `ADMIN_EMAILS` in Vercel** (comma-separated). Unset means no admins.
- #11 admin UI: still needs your actual use case before more is built. The
  one existing route is read-only; anything that *writes* (comping a
  subscription) must stay service-role-only — `subscriptions` is
  select-only for clients and that policy must not be relaxed for an admin
  panel.
- `getUserByEmail()` pages the full auth user list (capped at 50 pages ×
  200 = 10k users) because GoTrue's server-side email filter is not
  consistent across versions. Past ~10k users a real user would start
  reporting as "not found" — revisit before that becomes plausible.
