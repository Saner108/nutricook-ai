-- NutriCook AI — Admin audit log addendum.
-- Run this once in the Supabase SQL editor, in addition to migration.sql.
--
-- This is the append-only record of privileged admin actions (who did what, to
-- whom, and whether it was allowed). It is an audit trail, not application
-- state: nothing in the app reads it, no user-facing feature depends on it,
-- and it is deliberately not joined to the rest of the schema. It is not a
-- replacement for quota/rate-limit enforcement — consume_quota and
-- check_rate_limit remain the only things that actually stop a request; this
-- table only records that an admin acted.

-- ── Table ─────────────────────────────────────────────────────────────────
-- admin_email and admin_user_id are nullable, and `outcome` exists, so that
-- DENIED and ERRORED attempts can be logged too — including attempts by a
-- caller with no verified admin identity at all. An audit log that can only
-- record authorized successes is not a security control: the rows you most
-- want after an incident are exactly the ones where the identity was missing
-- or the action was refused.
--
-- There are deliberately NO foreign keys on admin_user_id, target_user_id or
-- target_user_email. Every other table here cascades from profiles/auth.users,
-- but cascading here would mean deleting a user erases the record that an
-- admin deleted them. `on delete set null` is equally wrong — it destroys
-- attribution and leaves an anonymous row. These columns are intentionally
-- unreferenced snapshots that must outlive the users they name.
--
-- `details` is for small, non-sensitive context only (e.g. a reason string, a
-- changed field name, a count). Never put request or response bodies in it.
-- Never put tokens, API keys or Stripe secrets in it. No PII beyond the emails
-- already columnized above.
create table if not exists admin_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid,
  admin_email text,
  action text not null,
  outcome text not null default 'ok' check (outcome in ('ok', 'denied', 'error')),
  target_user_id uuid,
  target_user_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────
-- The two composites are what real queries actually look like: "what did this
-- admin do recently" and "what was done to this user". A standalone
-- admin_email index would be near-useless at ~3 admins — the leading column
-- barely narrows anything, so the trailing created_at is what earns its keep.
create index if not exists admin_logs_created_at_idx
  on admin_logs (created_at desc);
create index if not exists admin_logs_admin_email_created_at_idx
  on admin_logs (admin_email, created_at desc);
create index if not exists admin_logs_target_user_email_created_at_idx
  on admin_logs (target_user_email, created_at desc);

-- ── Row-Level Security ────────────────────────────────────────────────────
alter table admin_logs enable row level security;
-- Zero policies, deliberately. This table is written and read ONLY by the
-- serverless service-role key. Unlike subscriptions/usage_counters there is
-- deliberately no owner-read policy: no client may read these rows — not even
-- the audited user, who is precisely the person with a motive to read or
-- dispute them. Same posture as rate_limit_hits.

-- ── Defense in depth ──────────────────────────────────────────────────────
-- RLS with no policies already denies everything, so this is belt-and-braces:
-- it keeps the table unreadable even if RLS is ever accidentally disabled on
-- it (a migration, a console click, a restore). service_role is unaffected —
-- it carries BYPASSRLS and is not a member of anon/authenticated.
revoke all on table admin_logs from anon, authenticated;

-- ── Housekeeping ──────────────────────────────────────────────────────────
-- Optional retention: audit rows accumulate forever otherwise. Left commented
-- out on purpose. Unlike the rate_limit_hits prune, this is NOT bloat control
-- — these rows hold user PII (emails) and are the only record of privileged
-- action, so turning this on is a deliberate retention-policy choice, not a
-- correctness fix. Deleting them destroys evidence you may later need.
-- delete from admin_logs where created_at < now() - interval '1 year';
