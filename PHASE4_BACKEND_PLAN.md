# NutriCook AI — Phase 4: Backend, Auth & Persistence Plan

**Repo:** github.com/Saner108/nutricook-ai · **Current state:** v2.5.0 — React 18 + Vite frontend (`artifacts/NutriCookAI_v2.tsx`), Vercel serverless (`api/generate.js`, `api/checkout.js`, `api/stripe-webhook.js`). All user data (profile, weights, favorites, grocery, quotas, Pro status) is session-only mock state. Phase 4 makes it real.

---

## 1. Stack Decision

**Recommended: Supabase** (one vendor covers Postgres + Auth + Row-Level Security, generous free tier, `@supabase/supabase-js` works in browser + serverless).

- Auth: Supabase Auth — email/password + Google OAuth. Session persisted via `@supabase/supabase-js` (its own storage handling is allowed; the "no localStorage" rule applies to hand-rolled app code, not the auth SDK).
- Database: Supabase Postgres with RLS so each user can only read/write their own rows.
- Data access: frontend talks to Supabase directly via RLS for CRUD (profiles, logs, lists, grocery). AI calls and Stripe stay behind Vercel functions.
- Alternative if preferred: Clerk (auth) + Neon (Postgres) — same schema applies.

**New env vars:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (frontend-safe), `SUPABASE_SERVICE_ROLE_KEY` (serverless only — quota writes + webhook).

---

## 2. Database Schema (SQL migration)

```sql
-- profiles: 1 row per auth user, created by trigger on signup
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  goal text not null default 'Muscle Gain',
  weight_lbs numeric,
  target_lbs numeric,
  units text not null default 'imperial' check (units in ('imperial','metric')),
  kcal_target int not null default 2200,
  protein_target int not null default 165,
  carbs_target int not null default 220,
  fat_target int not null default 73,
  water_target int not null default 8,
  dietary_prefs jsonb not null default '[]',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);

create table weight_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  logged_on date not null default current_date,
  weight_lbs numeric not null,
  unique (user_id, logged_on)          -- one log per day, upsert on re-log
);

create table meal_logs (                -- powers real history (Plan tab, past weeks)
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  eaten_on date not null,
  slot text not null check (slot in ('Breakfast','Lunch','Dinner','Snack')),
  name text not null, emoji text default '🍽',
  kcal int not null, protein int not null, carbs int not null, fat int not null,
  done boolean not null default true,
  unique (user_id, eaten_on, slot)
);

create table water_logs (
  user_id uuid not null references profiles(id) on delete cascade,
  logged_on date not null default current_date,
  glasses int not null default 0,
  primary key (user_id, logged_on)
);

create table recipes (                  -- every AI recipe a user saves
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null, difficulty text, prep_time text, servings int,
  macros jsonb not null, ingredients jsonb not null default '[]', steps jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table favorites (                -- hearted dishes (snapshot, works for mock meals + recipes)
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null, emoji text, kcal int, protein int, carbs int, fat int,
  unique (user_id, name)
);

create table try_list (
  user_id uuid not null references profiles(id) on delete cascade,
  recipe_id bigint not null references recipes(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table grocery_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null, qty text default '', category text not null default 'Other',
  done boolean not null default false, source text default 'manual',   -- manual | recipe | seed
  created_at timestamptz not null default now()
);

create table subscriptions (            -- written ONLY by the Stripe webhook (service role)
  user_id uuid primary key references profiles(id) on delete cascade,
  stripe_customer_id text, stripe_subscription_id text,
  status text not null default 'none',  -- none | active | past_due | canceled
  current_period_end timestamptz
);

create table usage_counters (           -- server-side free-tier enforcement
  user_id uuid not null references profiles(id) on delete cascade,
  used_on date not null default current_date,
  generations int not null default 0,
  scans int not null default 0,
  primary key (user_id, used_on)
);
```

**RLS:** enable on every table; policy `user_id = auth.uid()` (profiles: `id = auth.uid()`) for select/insert/update/delete. `subscriptions` and `usage_counters`: users get **select only**; writes happen via service-role key in serverless functions. Add a `handle_new_user()` trigger on `auth.users` insert that creates the `profiles` row.

---

## 3. Serverless API Changes

- **`api/generate.js`** — now requires `Authorization: Bearer <supabase access token>`. Verify the JWT with Supabase, load subscription + today's `usage_counters` (service role). If not active subscriber and quota exceeded (3 generations / 1 scan per UTC day — detect scan requests by an image block in messages), return **402 `{ error: { code: "quota_exceeded" } }`** — the frontend opens the paywall on 402. Otherwise increment the counter atomically (`insert ... on conflict do update set generations = usage_counters.generations + 1`) and proxy to Anthropic as today (streaming preserved). No token → 401.
- **`api/checkout.js`** — requires auth; look up or create a Stripe Customer with the user's email, set `client_reference_id` + `metadata.user_id` on the Checkout Session so the webhook can attribute it.
- **`api/stripe-webhook.js`** — on `checkout.session.completed` / `customer.subscription.updated|deleted`: upsert `subscriptions` row (status, period end) via service role. This is the single source of truth for Pro.

---

## 4. Frontend Changes (artifacts/NutriCookAI_v2.tsx)

1. **Auth gate:** if no session → AuthScreen (email/password sign in / sign up + "Continue with Google"), styled with the T tokens, inside the 430px frame. No `<form>` tags (onClick handlers as everywhere else).
2. **Onboarding (first login):** 3-step slide flow — name → goal preset (drives kcal/macro targets, editable) → current + target weight. Writes `profiles`, sets `onboarded = true`.
3. **Replace all mock state with live data on login:** profile (name, goal, targets, units, prefs), weight logs → chart, favorites, try list (join `recipes`), grocery items (seed a starter list on first login with `source='seed'`), water for today, meal logs → Plan history (real data replaces `historyFor()`; keep the generator only as a "demo mode" fallback when Supabase env vars are absent).
4. **Write-through on every action:** heart → favorites upsert/delete; Save recipe → insert `recipes` + `try_list` + grocery rows; grocery check/add → update/insert; water taps → upsert `water_logs`; weight log → upsert `weight_logs`; unit/pref/goal changes → update `profiles`; marking a meal done on Home → upsert `meal_logs` for today (this is what builds real history over time).
5. **Pro status:** read `subscriptions` on load (`status = 'active'` and `current_period_end > now()` → Pro). Remove client-side quota counting — the meter shows what the server reports; on 402 from `/api/generate`, open the paywall.
6. **Streak:** compute from `meal_logs` (consecutive days with ≥1 done meal) — replaces the hardcoded 12.
7. **Sign out** row in Profile settings; show account email.
8. **Demo mode:** if `SUPABASE_URL` is absent, run exactly as v2.5 does today (mocks, session state) so the app still demos with zero setup.

---

## 5. Also Worth Doing In This Phase

- **Error/loading states** for every fetch (skeleton shimmer cards exist — reuse).
- **Optimistic updates** with rollback on failure for hearts, checkboxes, water.
- **`test/`:** keep the 6 streaming tests green (do not break the source contracts: `await streamRecipes(apiKey, prompt`, `setStreamName(partialName)`, `loading && recipes.length < 3 &&`, `{streamName}`). Add unit tests for quota logic (pure function: `canGenerate(sub, counters, now)`) and streak computation.
- **README:** setup guide (Supabase project → run migration SQL → env vars in Vercel; Stripe test keys; screenshots).
- **Security checklist:** service-role key never in frontend; RLS verified by attempting cross-user reads; webhook signature verification kept; Anthropic key unchanged server-side.

## 6. Suggested Build Order (each step ends green: build + 6/6 tests)

1. Supabase client + auth gate + onboarding + profiles (demo-mode fallback intact).
2. Migration SQL file committed (`db/migration.sql`) + RLS policies.
3. Data sync: weights, favorites, try list, recipes, grocery, water, prefs/units.
4. Meal logging + real Plan history + streak.
5. Server-side quotas in `api/generate.js` (401/402 flow) + paywall-on-402.
6. Stripe ↔ user linkage + webhook persistence of `subscriptions`.
7. QA pass: fresh-signup walkthrough, second-account isolation check (RLS), Pro upgrade end-to-end with Stripe test card `4242 4242 4242 4242`.

**What Cesar must do manually:** create a free Supabase project (copy URL + anon + service-role keys), run `db/migration.sql` in the SQL editor, add env vars in Vercel, and (when ready) create the Stripe product/price + webhook endpoint pointing at `/api/stripe-webhook`.
