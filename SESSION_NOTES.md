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

## Code review pass (post-admin-route review)

A `/code-review` over the full branch diff surfaced 15 findings. All but one
were fixed; details below.

**Fixed:**
- No `/api/generate` caller (`remix`, `streamRecipes`, fridge scan) ever sent
  an `Authorization` header — every request 401s once Supabase is configured,
  silently making the new rate limiter unreachable. Pre-existing, not
  introduced this session, but only visible once Supabase is actually turned
  on (demo mode skips the auth check entirely). Fixed via a shared
  `authHeaders()` helper, injected into `streamRecipes` through its existing
  `fetchFn` param — the frozen signature is untouched, only the default
  implementation used when no `fetchFn` is passed.
- `downscaleImageToBase64`'s `img.onload` body could throw uncaught (e.g.
  `getContext` returning null) without ever settling the promise, hanging the
  scan UI forever. Now wrapped in try/catch with an explicit `reject`.
- The 4MB fridge-photo cap was checked *after* `useQuota("scan")`, so an
  oversized photo that never left the browser still cost a scan. Reordered,
  and the cap raised to 12MB — the whole point of downscaling is handling
  large photos, so a 4MB raw-file cap was rejecting the case it exists for.
- Onboarding's `finish()` ran `db.updateProfile` and `db.seedStarter` via
  `Promise.all`. If `updateProfile` failed after `seedStarter` had already
  succeeded, retrying `finish()` re-inserted the whole starter grocery list
  (`grocery_items` has no unique constraint, plain `insert` not `upsert`).
  Reverted to sequential for this specific pair — `db.js`'s internal
  grocery+weight parallelism inside `seedStarter` was fine and is unchanged.
- Sign-in lockout: after the 5th failure set the cooldown, the generic
  provider error message immediately overwrote it, so the user only learned
  they were locked out on their *next* attempt. Fixed to show the cooldown
  message immediately.
- `db.updateProfile`/`db.seedStarter` each called `supabase.auth.getUser()`
  independently; called concurrently from onboarding this meant two redundant
  network round trips before either write started. Both now take an optional
  `uid` param (backward compatible — all other call sites still self-lookup),
  wired through from the session at the one call site that had it available.
- `admin_logs`/`rate_limit_hits`: the admin_logs migration's comment claimed
  "same posture as rate_limit_hits" but only admin_logs actually had
  `revoke all from anon, authenticated`. Cesar approved adding the matching
  revoke to `rate_limit_hits` (unrun migration, safe in-place edit) — see
  `db/migration_ratelimit.sql`.
- `getUserByEmail()` returned `null` for both "confirmed not found" and "the
  lookup itself failed" (network error, bad GoTrue response), so a transient
  failure was recorded in the append-only audit log as a false "user does not
  exist." Now returns `undefined` for a failed lookup, `null` only after a
  fully-scanned miss; `getUser.js` logs `outcome:"error"` and returns 502 on
  `undefined` instead of a false 404.
- `requireAdmin()` collapsed both denial reasons to `null`, forcing
  `getUser.js` to call `getUser()` a second time just to figure out which one
  happened (and what to log). Now returns a discriminated result
  (`{ok:false, reason, caller}`); the second call is gone.
- Profile + subscription reads in `getUser.js` were sequential and the
  fail-closed comment overclaimed ("aborts the whole action" when the reads
  had already executed). Parallelized via `Promise.all`; comment corrected to
  state the actual guarantee — no *response* leaves without a matching audit
  record, not that the reads themselves are prevented.
- `api/generate.js`'s rate-limit and quota fail-open branches were completely
  silent — with `migration_ratelimit.sql` unrun (still true), rate limiting
  has been a silent no-op with zero signal. Both branches now `console.warn`.
- `insertRow`/`upsert` in `_lib/supabaseAdmin.js` were near-duplicate code.
  Merged into an internal `writeRows(table, rows, {merge})`; both exports are
  now thin wrappers, each keeping its own doc comment.
- Unauthenticated callers could flood `admin_logs` with arbitrary
  attacker-controlled `email` values (denied attempts are audit-logged by
  design). Added format/length validation (must contain `@`, ≤254 chars)
  *before* `requireAdmin()` runs or anything is logged — closes the
  "10KB garbage string" case. **Does not** stop a flood of short,
  well-formed-looking strings — see open items below.
- Added `test/admin-auth.test.mjs`: `isAllowlisted()` unset/empty denies
  everyone (the single most load-bearing behavior here) plus case-insensitive
  matching, `requireAdmin()`'s no-token path, `getUserByEmail()`'s
  undefined-vs-null contract on the paths reachable without a live network
  call. Full suite: 42/42.

**Deliberately not fixed — reasoning, not an oversight:**
- The review flagged that `persistSession:false` + Stripe's redirect-based
  checkout means the in-memory session is gone when the browser returns from
  Stripe, so `?upgraded=1`'s effect never fires and (per the review) "Pro is
  never reflected." **That claim is overstated.** Traced it: `pro` state is
  initialized directly from `isProActive(boot?.sub)`, where `boot.sub` is the
  real `subscriptions` row loaded fresh on every boot — independent of the
  query param. So Pro status is correct the moment the user is signed back
  in, regardless of whether `?upgraded=1` survived. The only real loss is a
  cosmetic "You're now Pro!" confirmation, and only on the sub-path where the
  user re-authenticates via **OAuth** specifically (OAuth's
  `redirectTo: window.location.origin` strips the query string; email/password
  sign-in doesn't touch the URL at all, so the param survives and the effect
  fires normally there). Not changed because I can't verify Supabase's
  redirect-URL allowlist behavior against the live project from here — if
  it does exact-match rather than ignoring query strings, widening
  `redirectTo` to preserve the query could break OAuth sign-in outright,
  which is a worse outcome than a missing toast. Flagging for a decision with
  real Supabase-dashboard access, not fixing blind.
- Unauthenticated flooding of `/api/admin/getUser` is only partially
  mitigated (see above). Closing it fully needs IP-based rate limiting, which
  has no existing hook in this schema (`check_rate_limit` is keyed on a
  `uuid` user id, not available for an anonymous caller) — that's a new
  schema/infra decision, not something to invent unilaterally mid-fix.

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
